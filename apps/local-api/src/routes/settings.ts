import type { FastifyInstance } from "fastify";
import type { DbClient } from "../db.js";
import { asObject, handleRouteError, optionalInteger } from "../http.js";

export async function registerSettingsRoutes(app: FastifyInstance, db: DbClient) {
  app.get("/api/settings", async (_request, reply) => {
    try {
      let settings = await (db as any).salonSettings.findUnique({
        where: { id: "default" },
      });

      // Auto-create if not exists
      if (!settings) {
        settings = await (db as any).salonSettings.create({
          data: { id: "default", turnCountThresholdCents: 3000 },
        });
      }

      return {
        id: settings.id,
        turnCountThresholdCents: settings.turnCountThresholdCents,
        updatedAt: settings.updatedAt,
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.patch("/api/settings", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const threshold = optionalInteger(body.turnCountThresholdCents, "turnCountThresholdCents");

      const data: Record<string, unknown> = { updatedAt: new Date() };
      if (threshold != null) {
        data.turnCountThresholdCents = threshold;
      }

      const settings = await (db as any).salonSettings.upsert({
        where: { id: "default" },
        update: data,
        create: { id: "default", ...data },
      });

      return {
        id: settings.id,
        turnCountThresholdCents: settings.turnCountThresholdCents,
        updatedAt: settings.updatedAt,
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}