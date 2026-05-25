import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();
const SEEDED_WORKER_PASSWORD = "1234";
const SEEDED_OWNER_PASSWORD = "1234";

const ids = {
  owner: "00000000-0000-0000-0000-000000000001",
  customers: {
    mary: "00000000-0000-0000-0000-000000000301",
    linda: "00000000-0000-0000-0000-000000000302",
    grace: "00000000-0000-0000-0000-000000000303",
    nina: "00000000-0000-0000-0000-000000000304",
    sarah: "00000000-0000-0000-0000-000000000305",
    olivia: "00000000-0000-0000-0000-000000000306",
    emma: "00000000-0000-0000-0000-000000000307",
  },
  checkins: {
    mary: "00000000-0000-0000-0000-000000000401",
    linda: "00000000-0000-0000-0000-000000000402",
    grace: "00000000-0000-0000-0000-000000000403",
    nina: "00000000-0000-0000-0000-000000000404",
    sarah: "00000000-0000-0000-0000-000000000405",
  },
  appointments: {
    olivia: "00000000-0000-0000-0000-000000000501",
    emma: "00000000-0000-0000-0000-000000000502",
  },
  turns: {
    linda: "00000000-0000-0000-0000-000000000601",
    grace: "00000000-0000-0000-0000-000000000602",
    sarah: "00000000-0000-0000-0000-000000000603",
  },
  sales: {
    sarah: "00000000-0000-0000-0000-000000000701",
  },
  saleItems: {
    sarah: "00000000-0000-0000-0000-000000000801",
  },
  payments: {
    sarahCash: "00000000-0000-0000-0000-000000000901",
  },
};

async function main() {
  const ownerPasswordHash = hashSecret(SEEDED_OWNER_PASSWORD);
  const owner = await prisma.user.upsert({
    where: { email: "owner@example.com" },
    update: {
      name: "Owner",
      role: "owner",
      passwordHash: ownerPasswordHash,
      pinHash: "dev-pin-placeholder",
      active: true,
    },
    create: {
      id: ids.owner,
      name: "Owner",
      email: "owner@example.com",
      role: "owner",
      passwordHash: ownerPasswordHash,
      pinHash: "dev-pin-placeholder",
    },
  });

  const workers = await seedWorkers();
  const services = await seedCatalog();
  await seedDemoDay(owner.id, workers, services);

  await prisma.auditLog.create({
    data: {
      userId: owner.id,
      action: "seed.demo_day_initialized",
      entityType: "system",
      metadataJson: { milestone: "seeded-demo-owner-pos" },
    },
  });
}

async function seedWorkers() {
  const workerInputs = [
    { name: "Amy", email: "amy@example.com", commissionRate: "0.6000", sortOrder: 1, currentStatus: "available" as const },
    { name: "Bella", email: "bella@example.com", commissionRate: "0.5500", sortOrder: 2, currentStatus: "available" as const },
    { name: "Cindy", email: "cindy@example.com", commissionRate: "0.5000", sortOrder: 3, currentStatus: "in_service" as const },
  ];
  const workers = [];

  for (const worker of workerInputs) {
    const passwordHash = hashSecret(SEEDED_WORKER_PASSWORD);
    const user = await prisma.user.upsert({
      where: { email: worker.email },
      update: {
        name: worker.name,
        role: "worker",
        passwordHash,
        pinHash: "dev-pin-placeholder",
        active: true,
      },
      create: {
        name: worker.name,
        email: worker.email,
        role: "worker",
        passwordHash,
        pinHash: "dev-pin-placeholder",
      },
    });

    const record = await prisma.worker.upsert({
      where: { userId: user.id },
      update: {
        displayName: worker.name,
        commissionRate: worker.commissionRate,
        currentStatus: worker.currentStatus,
        active: true,
        sortOrder: worker.sortOrder,
      },
      create: {
        userId: user.id,
        displayName: worker.name,
        commissionRate: worker.commissionRate,
        currentStatus: worker.currentStatus,
        sortOrder: worker.sortOrder,
      },
    });

    workers.push(record);
  }

  return workers;
}

function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(secret, salt, 64).toString("hex");
  return `${salt}:${key}`;
}

async function seedCatalog() {
  const manicure = await prisma.serviceCategory.upsert({
    where: { id: "00000000-0000-0000-0000-000000000101" },
    update: { name: "Manicure", sortOrder: 1, active: true },
    create: {
      id: "00000000-0000-0000-0000-000000000101",
      name: "Manicure",
      sortOrder: 1,
    },
  });

  const pedicure = await prisma.serviceCategory.upsert({
    where: { id: "00000000-0000-0000-0000-000000000102" },
    update: { name: "Pedicure", sortOrder: 2, active: true },
    create: {
      id: "00000000-0000-0000-0000-000000000102",
      name: "Pedicure",
      sortOrder: 2,
    },
  });

  const serviceInputs = [
    {
      id: "00000000-0000-0000-0000-000000000201",
      categoryId: manicure.id,
      name: "Classic Manicure",
      description: "Shape, cuticle care, lotion, and polish.",
      priceCents: 2500,
      durationMinutes: 30,
      sortOrder: 1,
    },
    {
      id: "00000000-0000-0000-0000-000000000202",
      categoryId: manicure.id,
      name: "Gel Manicure",
      description: "Classic manicure with gel polish.",
      priceCents: 4000,
      durationMinutes: 45,
      sortOrder: 2,
    },
    {
      id: "00000000-0000-0000-0000-000000000203",
      categoryId: pedicure.id,
      name: "Classic Pedicure",
      description: "Soak, shape, cuticle care, massage, and polish.",
      priceCents: 4500,
      durationMinutes: 45,
      sortOrder: 1,
    },
    {
      id: "00000000-0000-0000-0000-000000000204",
      categoryId: pedicure.id,
      name: "Deluxe Pedicure",
      description: "Classic pedicure with scrub and extended massage.",
      priceCents: 6500,
      durationMinutes: 60,
      sortOrder: 2,
    },
  ];
  const services = [];

  for (const service of serviceInputs) {
    services.push(
      await prisma.service.upsert({
        where: { id: service.id },
        update: {
          categoryId: service.categoryId,
          name: service.name,
          description: service.description,
          priceCents: service.priceCents,
          durationMinutes: service.durationMinutes,
          sortOrder: service.sortOrder,
          active: true,
        },
        create: service,
      })
    );
  }

  return services;
}

async function seedDemoDay(
  ownerId: string,
  workers: Awaited<ReturnType<typeof seedWorkers>>,
  services: Awaited<ReturnType<typeof seedCatalog>>
) {
  const [amy, bella, cindy] = workers;
  const [, gelManicure, classicPedicure, deluxePedicure] = services;
  const now = new Date();
  const at = (hour: number, minute = 0) => {
    const date = new Date(now);
    date.setHours(hour, minute, 0, 0);
    return date;
  };

  const customers = await Promise.all([
    upsertCustomer(ids.customers.mary, "Mary Nguyen", "555-0101"),
    upsertCustomer(ids.customers.linda, "Linda Tran", "555-0102"),
    upsertCustomer(ids.customers.grace, "Grace Kim", "555-0103"),
    upsertCustomer(ids.customers.nina, "Nina Patel", "555-0104"),
    upsertCustomer(ids.customers.sarah, "Sarah Johnson", "555-0105"),
    upsertCustomer(ids.customers.olivia, "Olivia Brown", "555-0106"),
    upsertCustomer(ids.customers.emma, "Emma Wilson", "555-0107"),
  ]);
  const [mary, linda, grace, nina, sarah, olivia, emma] = customers;

  await prisma.appointment.upsert({
    where: { id: ids.appointments.olivia },
    update: {
      customerId: olivia.id,
      workerId: amy.id,
      startTime: at(14, 0),
      endTime: at(14, 45),
      status: "confirmed",
      notes: "Gel manicure appointment",
      createdByUserId: ownerId,
    },
    create: {
      id: ids.appointments.olivia,
      customerId: olivia.id,
      workerId: amy.id,
      startTime: at(14, 0),
      endTime: at(14, 45),
      status: "confirmed",
      notes: "Gel manicure appointment",
      createdByUserId: ownerId,
    },
  });

  await prisma.appointment.upsert({
    where: { id: ids.appointments.emma },
    update: {
      customerId: emma.id,
      workerId: bella.id,
      startTime: at(15, 30),
      endTime: at(16, 30),
      status: "scheduled",
      notes: "Deluxe pedicure appointment",
      createdByUserId: ownerId,
    },
    create: {
      id: ids.appointments.emma,
      customerId: emma.id,
      workerId: bella.id,
      startTime: at(15, 30),
      endTime: at(16, 30),
      status: "scheduled",
      notes: "Deluxe pedicure appointment",
      createdByUserId: ownerId,
    },
  });

  await prisma.checkin.upsert({
    where: { id: ids.checkins.mary },
    update: { customerId: mary.id, requestedWorkerId: null, notes: "Walk-in classic pedicure", status: "waiting", checkedInAt: at(10, 0) },
    create: { id: ids.checkins.mary, customerId: mary.id, notes: "Walk-in classic pedicure", status: "waiting", checkedInAt: at(10, 0) },
  });
  await prisma.checkin.upsert({
    where: { id: ids.checkins.linda },
    update: { customerId: linda.id, requestedWorkerId: amy.id, notes: "Requested Amy for gel manicure", status: "assigned", checkedInAt: at(10, 10) },
    create: { id: ids.checkins.linda, customerId: linda.id, requestedWorkerId: amy.id, notes: "Requested Amy for gel manicure", status: "assigned", checkedInAt: at(10, 10) },
  });
  await prisma.checkin.upsert({
    where: { id: ids.checkins.grace },
    update: { customerId: grace.id, requestedWorkerId: cindy.id, notes: "Currently receiving deluxe pedicure", status: "in_service", checkedInAt: at(10, 20) },
    create: { id: ids.checkins.grace, customerId: grace.id, requestedWorkerId: cindy.id, notes: "Currently receiving deluxe pedicure", status: "in_service", checkedInAt: at(10, 20) },
  });
  await prisma.checkin.upsert({
    where: { id: ids.checkins.nina },
    update: { customerId: nina.id, requestedWorkerId: bella.id, notes: "Ready for checkout", status: "ready_for_checkout", checkedInAt: at(9, 30) },
    create: { id: ids.checkins.nina, customerId: nina.id, requestedWorkerId: bella.id, notes: "Ready for checkout", status: "ready_for_checkout", checkedInAt: at(9, 30) },
  });
  await prisma.checkin.upsert({
    where: { id: ids.checkins.sarah },
    update: { customerId: sarah.id, requestedWorkerId: amy.id, notes: "Paid earlier today", status: "paid", checkedInAt: at(8, 30) },
    create: { id: ids.checkins.sarah, customerId: sarah.id, requestedWorkerId: amy.id, notes: "Paid earlier today", status: "paid", checkedInAt: at(8, 30) },
  });

  await prisma.turn.upsert({
    where: { id: ids.turns.linda },
    update: { workerId: amy.id, customerId: linda.id, checkinId: ids.checkins.linda, turnType: "requested_worker", status: "assigned", assignedByUserId: ownerId, suggestedWorkerId: amy.id, startedAt: null, endedAt: null, completedAt: null, skippedAt: null },
    create: { id: ids.turns.linda, workerId: amy.id, customerId: linda.id, checkinId: ids.checkins.linda, turnType: "requested_worker", status: "assigned", assignedByUserId: ownerId, suggestedWorkerId: amy.id },
  });
  await prisma.turn.upsert({
    where: { id: ids.turns.grace },
    update: { workerId: cindy.id, customerId: grace.id, checkinId: ids.checkins.grace, turnType: "walk_in", status: "in_service", assignedByUserId: ownerId, suggestedWorkerId: cindy.id, startedAt: at(10, 35), endedAt: null, completedAt: null, skippedAt: null },
    create: { id: ids.turns.grace, workerId: cindy.id, customerId: grace.id, checkinId: ids.checkins.grace, turnType: "walk_in", status: "in_service", assignedByUserId: ownerId, suggestedWorkerId: cindy.id, startedAt: at(10, 35) },
  });
  await prisma.turn.upsert({
    where: { id: ids.turns.sarah },
    update: { workerId: amy.id, customerId: sarah.id, checkinId: ids.checkins.sarah, turnType: "walk_in", status: "completed", assignedByUserId: ownerId, suggestedWorkerId: amy.id, startedAt: at(8, 45), endedAt: at(9, 25), completedAt: at(9, 25), skippedAt: null },
    create: { id: ids.turns.sarah, workerId: amy.id, customerId: sarah.id, checkinId: ids.checkins.sarah, turnType: "walk_in", status: "completed", assignedByUserId: ownerId, suggestedWorkerId: amy.id, startedAt: at(8, 45), endedAt: at(9, 25), completedAt: at(9, 25) },
  });

  await prisma.sale.upsert({
    where: { id: ids.sales.sarah },
    update: {
      customerId: sarah.id,
      checkinId: ids.checkins.sarah,
      status: "paid",
      subtotalCents: classicPedicure.priceCents,
      discountTotalCents: 0,
      taxTotalCents: 0,
      tipTotalCents: 1000,
      totalCents: classicPedicure.priceCents + 1000,
      amountPaidCents: classicPedicure.priceCents + 1000,
      createdByUserId: ownerId,
      completedAt: at(9, 30),
    },
    create: {
      id: ids.sales.sarah,
      customerId: sarah.id,
      checkinId: ids.checkins.sarah,
      status: "paid",
      subtotalCents: classicPedicure.priceCents,
      discountTotalCents: 0,
      taxTotalCents: 0,
      tipTotalCents: 1000,
      totalCents: classicPedicure.priceCents + 1000,
      amountPaidCents: classicPedicure.priceCents + 1000,
      createdByUserId: ownerId,
      completedAt: at(9, 30),
    },
  });

  await prisma.saleItem.upsert({
    where: { id: ids.saleItems.sarah },
    update: {
      saleId: ids.sales.sarah,
      serviceId: classicPedicure.id,
      workerId: amy.id,
      serviceNameSnapshot: classicPedicure.name,
      categoryNameSnapshot: "Pedicure",
      priceCents: classicPedicure.priceCents,
      discountCents: 0,
      finalServiceCents: classicPedicure.priceCents,
      commissionRateSnapshot: amy.commissionRate,
      workerCommissionCents: 2700,
      tipCents: 1000,
      workerTotalCents: 3700,
      businessCents: 1800,
      status: "active",
    },
    create: {
      id: ids.saleItems.sarah,
      saleId: ids.sales.sarah,
      serviceId: classicPedicure.id,
      workerId: amy.id,
      serviceNameSnapshot: classicPedicure.name,
      categoryNameSnapshot: "Pedicure",
      priceCents: classicPedicure.priceCents,
      discountCents: 0,
      finalServiceCents: classicPedicure.priceCents,
      commissionRateSnapshot: amy.commissionRate,
      workerCommissionCents: 2700,
      tipCents: 1000,
      workerTotalCents: 3700,
      businessCents: 1800,
    },
  });

  await prisma.payment.upsert({
    where: { id: ids.payments.sarahCash },
    update: { saleId: ids.sales.sarah, method: "cash", amountCents: classicPedicure.priceCents + 1000, tipCents: 0, status: "approved" },
    create: { id: ids.payments.sarahCash, saleId: ids.sales.sarah, method: "cash", amountCents: classicPedicure.priceCents + 1000, tipCents: 0, status: "approved" },
  });

  void gelManicure;
  void deluxePedicure;
}

async function upsertCustomer(id: string, name: string, phone: string) {
  return prisma.customer.upsert({
    where: { id },
    update: { name, phone },
    create: { id, name, phone },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
