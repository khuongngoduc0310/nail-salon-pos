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
<<<<<<< HEAD
    findFirst(args?: unknown): Promise<unknown | null>;
    findUnique(args: unknown): Promise<unknown | null>;
=======
    findMany(args?: unknown): Promise<unknown[]>;
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  worker: {
    findMany(args?: unknown): Promise<unknown[]>;
    findUnique(args: unknown): Promise<unknown | null>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  customer: {
    findMany(args?: unknown): Promise<unknown[]>;
    findUnique(args: unknown): Promise<unknown | null>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
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
  workSession: {
    findMany(args?: unknown): Promise<unknown[]>;
    findUnique(args: unknown): Promise<unknown | null>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  workerSessionCheckin: {
    findMany(args?: unknown): Promise<unknown[]>;
    create(args: unknown): Promise<unknown>;
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
    findMany(args?: unknown): Promise<unknown[]>;
    findUnique(args: unknown): Promise<unknown | null>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  payment: {
    findMany(args?: unknown): Promise<unknown[]>;
    findUnique(args: unknown): Promise<unknown | null>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
<<<<<<< HEAD
=======
  };
  receipt: {
    findMany(args?: unknown): Promise<unknown[]>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
  };
  discount: {
    findMany(args?: unknown): Promise<unknown[]>;
    create(args: unknown): Promise<unknown>;
  };
  refund: {
    findMany(args?: unknown): Promise<unknown[]>;
    create(args: unknown): Promise<unknown>;
  };
  $transaction<T>(callback: (tx: DbClient) => Promise<T>): Promise<T>;
};

export function createDbClient(): DbClient {
  return new PrismaClient() as unknown as DbClient;
}
