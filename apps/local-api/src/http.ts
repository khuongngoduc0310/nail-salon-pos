import type { FastifyReply, FastifyRequest } from "fastify";

export type JsonObject = Record<string, unknown>;

export class HttpError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function asObject(value: unknown, label = "body"): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, `${label} must be an object`);
  }

  return value as JsonObject;
}

export function optionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `${fieldName} must be a string`);
  }

  return value;
}

export function requiredString(value: unknown, fieldName: string): string {
  const text = optionalString(value, fieldName);
  if (!text) {
    throw new HttpError(400, `${fieldName} is required`);
  }

  return text;
}

export function optionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new HttpError(400, `${fieldName} must be a boolean`);
  }

  return value;
}

export function optionalInteger(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new HttpError(400, `${fieldName} must be an integer`);
  }

  return value;
}

export function requiredInteger(value: unknown, fieldName: string): number {
  const number = optionalInteger(value, fieldName);
  if (number === undefined) {
    throw new HttpError(400, `${fieldName} is required`);
  }

  return number;
}

export function optionalNumber(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new HttpError(400, `${fieldName} must be a number`);
  }

  return value;
}

export function requiredNumber(value: unknown, fieldName: string): number {
  const number = optionalNumber(value, fieldName);
  if (number === undefined) {
    throw new HttpError(400, `${fieldName} is required`);
  }

  return number;
}

export function optionalDate(value: unknown, fieldName: string): Date | undefined {
  const text = optionalString(value, fieldName);
  if (!text) {
    return undefined;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `${fieldName} must be a valid date`);
  }

  return date;
}

export function getParams(request: FastifyRequest): JsonObject {
  return asObject(request.params, "params");
}

export function getQuery(request: FastifyRequest): JsonObject {
  return asObject(request.query, "query");
}

export function handleRouteError(error: unknown, reply: FastifyReply) {
  if (error instanceof HttpError) {
    return reply.code(error.statusCode).send({ error: error.message });
  }

  throw error;
}
