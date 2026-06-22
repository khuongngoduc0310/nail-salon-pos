import type { FastifyRequest } from "fastify";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { HttpError } from "./http.js";

const OWNER_TOKEN_TTL_SECONDS = 60 * 60 * 12;
const OWNER_TOKEN_SECRET = process.env.OWNER_SESSION_SECRET ?? "dev-owner-session-secret";
const CUSTOMER_TOKEN_TTL_SECONDS = 60 * 60 * 12;
const CUSTOMER_TOKEN_SECRET = process.env.CUSTOMER_SESSION_SECRET ?? "dev-customer-session-secret";

export type OwnerSessionPayload = {
  userId: string;
  role: "owner";
  exp: number;
};

export type CustomerSessionPayload = {
  customerId: string;
  role: "customer";
  exp: number;
};

export function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(secret, salt, 64).toString("hex");
  return `${salt}:${key}`;
}

export function verifySecret(secret: string, encoded: string): boolean {
  const [salt, expectedKey] = encoded.split(":");
  if (!salt || !expectedKey) return false;
  const actualKey = scryptSync(secret, salt, 64).toString("hex");
  const expected = Buffer.from(expectedKey, "hex");
  const actual = Buffer.from(actualKey, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function issueOwnerToken(userId: string): { token: string; expiresAt: string } {
  const exp = Math.floor(Date.now() / 1000) + OWNER_TOKEN_TTL_SECONDS;
  const payload: OwnerSessionPayload = { userId, role: "owner", exp };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signOwnerTokenSegment(encodedPayload);
  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export function requireOwnerSession(request: FastifyRequest): OwnerSessionPayload {
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    throw new HttpError(401, "missing owner token");
  }
  const token = auth.slice("Bearer ".length).trim();
  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) {
    throw new HttpError(401, "invalid owner token");
  }

  const expectedSignature = signOwnerTokenSegment(encodedPayload);
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const providedBuffer = Buffer.from(providedSignature, "utf8");
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    throw new HttpError(401, "invalid owner token");
  }

  let payload: OwnerSessionPayload;
  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload)) as OwnerSessionPayload;
  } catch {
    throw new HttpError(401, "invalid owner token");
  }

  if (payload.role !== "owner" || !payload.userId || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new HttpError(401, "owner token expired");
  }
  return payload;
}

export function issueCustomerToken(customerId: string): { token: string; expiresAt: string } {
  const exp = Math.floor(Date.now() / 1000) + CUSTOMER_TOKEN_TTL_SECONDS;
  const payload: CustomerSessionPayload = { customerId, role: "customer", exp };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signCustomerTokenSegment(encodedPayload);
  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export function requireCustomerSession(request: FastifyRequest): CustomerSessionPayload {
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    throw new HttpError(401, "missing customer token");
  }
  const token = auth.slice("Bearer ".length).trim();
  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) {
    throw new HttpError(401, "invalid customer token");
  }

  const expectedSignature = signCustomerTokenSegment(encodedPayload);
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const providedBuffer = Buffer.from(providedSignature, "utf8");
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    throw new HttpError(401, "invalid customer token");
  }

  let payload: CustomerSessionPayload;
  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload)) as CustomerSessionPayload;
  } catch {
    throw new HttpError(401, "invalid customer token");
  }

  if (payload.role !== "customer" || !payload.customerId || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new HttpError(401, "customer token expired");
  }
  return payload;
}

function signOwnerTokenSegment(encodedPayload: string): string {
  const hmac = createHmac("sha256", OWNER_TOKEN_SECRET);
  hmac.update(encodedPayload);
  return encodeBase64Url(hmac.digest());
}

function signCustomerTokenSegment(encodedPayload: string): string {
  const hmac = createHmac("sha256", CUSTOMER_TOKEN_SECRET);
  hmac.update(encodedPayload);
  return encodeBase64Url(hmac.digest());
}

function encodeBase64Url(value: string | Buffer): string {
  const base64 = Buffer.isBuffer(value) ? value.toString("base64") : Buffer.from(value, "utf8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "===".slice((normalized.length + 3) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}
