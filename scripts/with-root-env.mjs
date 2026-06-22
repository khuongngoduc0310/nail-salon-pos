/* global console, process */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootEnvPath = resolve(repoRoot, ".env");

if (existsSync(rootEnvPath)) {
  for (const line of readFileSync(rootEnvPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] ??= value;
  }
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Usage: node scripts/with-root-env.mjs <command> [...args]");
  process.exit(1);
}

const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === "path") ?? "PATH";
const pathSeparator = process.platform === "win32" ? ";" : ":";
const commandPath = [
  resolve(process.cwd(), "node_modules", ".bin"),
  resolve(repoRoot, "node_modules", ".bin"),
  process.env[pathKey],
]
  .filter(Boolean)
  .join(pathSeparator);
process.env[pathKey] = commandPath;

const resolvedCommand = resolveCommand(command, commandPath);
const child = spawnChild(resolvedCommand, args);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  }
  process.exit(code ?? 1);
});

function spawnChild(resolvedCommand, args) {
  if (process.platform === "win32" && /\.(cmd|bat)$/i.test(resolvedCommand)) {
    return spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/c", [resolvedCommand, ...args.map(quoteWindowsArg)].join(" ")], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
  }

  return spawn(resolvedCommand, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
}

function quoteWindowsArg(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=@-]+$/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

function resolveCommand(command, searchPath) {
  if (process.platform !== "win32" || /\.[a-z0-9]+$/i.test(command)) {
    return command;
  }

  for (const directory of searchPath.split(pathSeparator)) {
    for (const extension of [".cmd", ".exe", ".bat"]) {
      const candidate = resolve(directory, `${command}${extension}`);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return command;
}
