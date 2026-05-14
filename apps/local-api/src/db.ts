import { PrismaClient } from "@nail/db";

export type DbClient = {
  serviceCategory: {
    findMany(args?: unknown): Promise<unknown[]>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  service: {
    findMany(args?: unknown): Promise<unknown[]>;
    findUnique(args: unknown): Promise<unknown | null>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  user: {
    create(args: unknown): Promise<unknown>;
  };
  worker: {
    findMany(args?: unknown): Promise<unknown[]>;
    findUnique(args: unknown): Promise<unknown | null>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  customer: {
    findMany(args?: unknown): Promise<unknown[]>;
    create(args: unknown): Promise<unknown>;
  };
  appointment: {
    findMany(args?: unknown): Promise<unknown[]>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  checkin: {
    findMany(args?: unknown): Promise<unknown[]>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  turn: {
    findMany(args?: unknown): Promise<unknown[]>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  sale: {
    findMany(args?: unknown): Promise<unknown[]>;
    findUnique(args: unknown): Promise<unknown | null>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  saleItem: {
    findUnique(args: unknown): Promise<unknown | null>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  payment: {
    create(args: unknown): Promise<unknown>;
  };
  discount: {
    create(args: unknown): Promise<unknown>;
  };
  $transaction<T>(callback: (tx: DbClient) => Promise<T>): Promise<T>;
};

export function createDbClient(): DbClient {
  return new PrismaClient() as unknown as DbClient;
}
