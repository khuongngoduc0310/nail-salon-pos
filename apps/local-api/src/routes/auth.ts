import type { FastifyInstance } from "fastify";
import type { DbClient } from "../db.js";
import { asObject, getParams, handleRouteError, requiredString } from "../http.js";

type AuthUser = {
  id: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  active?: boolean;
  pinHash: string | null;
  passwordHash: string | null;
};

const DEV_OWNER_AUTH_ID = "owner@example.com";
const DEV_OWNER_PIN = "1234";
const DEV_OWNER_PASSWORD = "password";

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === "string" &&
    typeof user.name === "string" &&
    typeof user.role === "string" &&
    (typeof user.email === "string" || user.email === null) &&
    (typeof user.phone === "string" || user.phone === null) &&
    (typeof user.pinHash === "string" || user.pinHash === null) &&
    (typeof user.passwordHash === "string" || user.passwordHash === null)
  );
}

/**
 * Verify a Bearer token and return the userId it encodes.
 * Returns null if the token is missing, malformed, or the user doesn't exist.
 * Exported for use by other route modules that need inline auth checks.
 */
export async function verifyWorkerToken(db: DbClient, authHeader: string | undefined): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  try {
    const token = authHeader.slice(7);
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [userId, role] = decoded.split(":");

    // Dev owner bypass in non-production
    if (process.env.NODE_ENV !== "production" && userId === "dev-owner") return userId;

    // Only workers and owners can use worker endpoints
    if (role !== "worker" && role !== "owner") return null;

    const user = await (db as any).user.findUnique({ where: { id: userId } });
    if (!user || !user.active) return null;

    return userId;
  } catch {
    return null;
  }
}

export async function registerAuthRoutes(app: FastifyInstance, db: DbClient) {
  app.post("/api/auth/login", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const emailOrPhone = requiredString(body.emailOrPhone, "emailOrPhone");
      const passwordOrPin = requiredString(body.passwordOrPin, "passwordOrPin");

      let user = await db.user.findFirst({
        where: {
          OR: [
            { email: emailOrPhone },
            { phone: emailOrPhone },
          ],
          active: true,
        },
      });

      if (!isAuthUser(user) && isDevOwnerAuthId(emailOrPhone)) {
        user = await db.user.findFirst({
          where: {
            role: "owner",
            active: true,
          },
        });
      }

      if (!isAuthUser(user) && isDevOwnerAuthId(emailOrPhone) && passwordOrPin === DEV_OWNER_PIN) {
        return buildAuthResponse({
          id: "dev-owner",
          name: "Dev Owner",
          role: "owner",
          email: DEV_OWNER_AUTH_ID,
          phone: null,
          pinHash: "dev-pin-placeholder",
          passwordHash: "dev-password-placeholder",
        });
      }

      if (!isAuthUser(user)) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }

      const validPin = isValidPin(user, emailOrPhone, passwordOrPin);
      const validPassword = isValidPassword(user, passwordOrPin);

      if (!validPin && !validPassword) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }

      return buildAuthResponse(user);
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Worker PIN-based login — used by the Worker PWA
  app.post("/api/auth/worker-login", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const workerId = requiredString(body.workerId, "workerId");
      const pin = requiredString(body.pin, "pin");

      const worker = await (db as any).worker.findUnique({
        where: { id: workerId, active: true },
        include: { user: true },
      });

      if (!worker) {
        return reply.code(401).send({ error: "Worker not found or inactive" });
      }

      const user = worker.user;
      if (!isAuthUser(user)) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }

      const validPin = isValidPin(user, user.email ?? "", pin);

      if (!validPin) {
        return reply.code(401).send({ error: "Invalid PIN" });
      }

      const token = Buffer.from(`${user.id}:${user.role}`).toString("base64");

      return {
        token,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
        },
        worker: {
          id: worker.id,
          displayName: worker.displayName,
          currentStatus: worker.currentStatus,
          commissionRate: Number(worker.commissionRate),
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/auth/logout", async () => {
    return { ok: true };
  });

  // Simple auth checker middleware helper
  app.get("/api/auth/me", async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return reply.code(401).send({ error: "Not authenticated" });
      }

      const token = authHeader.slice(7);
      const decoded = Buffer.from(token, "base64").toString("utf-8");
      const [userId] = decoded.split(":");

      if (process.env.NODE_ENV !== "production" && userId === "dev-owner") {
        return {
          user: {
            id: "dev-owner",
            name: "Dev Owner",
            role: "owner",
            email: DEV_OWNER_AUTH_ID,
            phone: null,
          },
        };
      }

      const user = await db.user.findUnique({
        where: { id: userId },
      });

      if (!isAuthUser(user)) {
        return reply.code(401).send({ error: "User not found" });
      }

      return {
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          email: user.email,
          phone: user.phone,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}

function buildAuthResponse(user: AuthUser) {
  const token = Buffer.from(`${user.id}:${user.role}`).toString("base64");

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email,
      phone: user.phone,
    },
  };
}

function isDevOwnerAuthId(emailOrPhone: string): boolean {
  return process.env.NODE_ENV !== "production" && emailOrPhone === DEV_OWNER_AUTH_ID;
}

function isValidPin(user: AuthUser, emailOrPhone: string, passwordOrPin: string): boolean {
  if (user.pinHash && passwordOrPin === user.pinHash) return true;

  if (process.env.NODE_ENV === "production") return false;

  if (user.pinHash === "dev-pin-placeholder" && passwordOrPin === DEV_OWNER_PIN) return true;
  return user.role === "owner" && emailOrPhone === DEV_OWNER_AUTH_ID && passwordOrPin === DEV_OWNER_PIN;
}

function isValidPassword(user: AuthUser, passwordOrPin: string): boolean {
  if (user.passwordHash && passwordOrPin === user.passwordHash) return true;

  if (process.env.NODE_ENV === "production") return false;

  return user.passwordHash === "dev-password-placeholder" && passwordOrPin === DEV_OWNER_PASSWORD;
}