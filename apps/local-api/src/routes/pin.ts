import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { HttpError } from "../http.js";

const pinPattern = /^\d{4,6}$/;
const scryptPrefix = "scrypt";
const keyLength = 32;

export function parseRequiredWorkerPin(value: unknown): string {
  if (typeof value !== "string" || value === "") {
    throw new HttpError(400, "pin is required");
  }

  return validateWorkerPin(value);
}

export function parseOptionalWorkerPin(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "pin must be a string");
  }

  return validateWorkerPin(value);
}

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, keyLength).toString("hex");
  return `${scryptPrefix}:${salt}:${hash}`;
}

export function verifyPin(pin: string, storedPinHash: string | null): boolean {
  if (!storedPinHash) return false;

  if (!storedPinHash.startsWith(`${scryptPrefix}:`)) {
    return pin === storedPinHash;
  }

  const [, salt, expectedHash] = storedPinHash.split(":");
  if (!salt || !expectedHash) return false;

  try {
    const expected = Buffer.from(expectedHash, "hex");
    const actual = scryptSync(pin, salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function validateWorkerPin(pin: string): string {
  if (!pinPattern.test(pin)) {
    throw new HttpError(400, "pin must be 4 to 6 digits");
  }

  return pin;
}
