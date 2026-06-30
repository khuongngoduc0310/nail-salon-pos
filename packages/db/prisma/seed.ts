import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEV_PIN_HASH = "dev-pin-placeholder";
const DEV_PASSWORD_HASH = "dev-password-placeholder";

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: "owner@nailsalon.local" },
    update: {
      name: "Salon Owner",
      phone: "+15550001000",
      role: "owner",
      active: true,
      passwordHash: DEV_PASSWORD_HASH,
      pinHash: DEV_PIN_HASH,
    },
    create: {
      name: "Salon Owner",
      email: "owner@nailsalon.local",
      phone: "+15550001000",
      role: "owner",
      passwordHash: DEV_PASSWORD_HASH,
      pinHash: DEV_PIN_HASH,
    },
  });

  await prisma.salonSettings.upsert({
    where: { id: "default" },
    update: { turnCountThresholdCents: 3000 },
    create: { id: "default", turnCountThresholdCents: 3000 },
  });

  const session = await prisma.session.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {
      status: "open",
      closedAt: null,
      closingCashCents: null,
      openingCashCents: 20000,
      openedByUserId: owner.id,
    },
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      status: "open",
      openingCashCents: 20000,
      openedByUserId: owner.id,
    },
  });

  const workers = [
    { name: "Amy Nguyen", displayName: "Amy", email: "amy@nailsalon.local", phone: "+15550001001", commissionRate: "0.6000", sortOrder: 1 },
    { name: "Bella Tran", displayName: "Bella", email: "bella@nailsalon.local", phone: "+15550001002", commissionRate: "0.5500", sortOrder: 2 },
    { name: "Cindy Pham", displayName: "Cindy", email: "cindy@nailsalon.local", phone: "+15550001003", commissionRate: "0.5000", sortOrder: 3 },
    { name: "Daisy Le", displayName: "Daisy", email: "daisy@nailsalon.local", phone: "+15550001004", commissionRate: "0.5000", sortOrder: 4 },
  ];

  const seededWorkers = [];

  for (const worker of workers) {
    const user = await prisma.user.upsert({
      where: { email: worker.email },
      update: {
        name: worker.name,
        phone: worker.phone,
        role: "worker",
        active: true,
        pinHash: DEV_PIN_HASH,
      },
      create: {
        name: worker.name,
        email: worker.email,
        phone: worker.phone,
        role: "worker",
        pinHash: DEV_PIN_HASH,
      },
    });

    const workerRecord = await prisma.worker.upsert({
      where: { userId: user.id },
      update: {
        displayName: worker.displayName,
        commissionRate: worker.commissionRate,
        currentStatus: "available",
        active: true,
        sortOrder: worker.sortOrder,
      },
      create: {
        userId: user.id,
        displayName: worker.displayName,
        commissionRate: worker.commissionRate,
        currentStatus: "available",
        sortOrder: worker.sortOrder,
      },
    });

    seededWorkers.push(workerRecord);

    await prisma.workerSession.upsert({
      where: { workerId_sessionId: { workerId: workerRecord.id, sessionId: session.id } },
      update: { checkedOutAt: null },
      create: { workerId: workerRecord.id, sessionId: session.id },
    });
  }

  const categories = [
    { id: "00000000-0000-0000-0000-000000000101", name: "Manicure", sortOrder: 1 },
    { id: "00000000-0000-0000-0000-000000000102", name: "Pedicure", sortOrder: 2 },
    { id: "00000000-0000-0000-0000-000000000103", name: "Acrylic & Dip", sortOrder: 3 },
    { id: "00000000-0000-0000-0000-000000000104", name: "Add-ons", sortOrder: 4 },
  ];

  for (const category of categories) {
    await prisma.serviceCategory.upsert({
      where: { id: category.id },
      update: { name: category.name, sortOrder: category.sortOrder, active: true },
      create: category,
    });
  }

  const services = [
    {
      id: "00000000-0000-0000-0000-000000000201",
      categoryId: categories[0].id,
      name: "Classic Manicure",
      description: "Shape, cuticle care, lotion, and polish.",
      priceCents: 2500,
      durationMinutes: 30,
      turnCount: 0,
      sortOrder: 1,
    },
    {
      id: "00000000-0000-0000-0000-000000000202",
      categoryId: categories[0].id,
      name: "Gel Manicure",
      description: "Classic manicure with gel polish.",
      priceCents: 4000,
      durationMinutes: 45,
      turnCount: 1,
      sortOrder: 2,
    },
    {
      id: "00000000-0000-0000-0000-000000000203",
      categoryId: categories[1].id,
      name: "Classic Pedicure",
      description: "Soak, shape, cuticle care, massage, and polish.",
      priceCents: 4500,
      durationMinutes: 45,
      turnCount: 1,
      sortOrder: 1,
    },
    {
      id: "00000000-0000-0000-0000-000000000204",
      categoryId: categories[1].id,
      name: "Deluxe Pedicure",
      description: "Classic pedicure with scrub and extended massage.",
      priceCents: 6500,
      durationMinutes: 60,
      turnCount: 1,
      sortOrder: 2,
    },
    {
      id: "00000000-0000-0000-0000-000000000205",
      categoryId: categories[2].id,
      name: "Full Set Acrylic",
      description: "Full acrylic set with regular polish.",
      priceCents: 5500,
      durationMinutes: 75,
      turnCount: 1,
      sortOrder: 1,
    },
    {
      id: "00000000-0000-0000-0000-000000000206",
      categoryId: categories[2].id,
      name: "Dip Powder",
      description: "Dip powder manicure with color.",
      priceCents: 5000,
      durationMinutes: 60,
      turnCount: 1,
      sortOrder: 2,
    },
    {
      id: "00000000-0000-0000-0000-000000000207",
      categoryId: categories[3].id,
      name: "French Tip Add-on",
      description: "French tip design added to a service.",
      priceCents: 1000,
      durationMinutes: 10,
      turnCount: 0,
      sortOrder: 1,
    },
    {
      id: "00000000-0000-0000-0000-000000000208",
      categoryId: categories[3].id,
      name: "Nail Art Add-on",
      description: "Simple nail art added to a service.",
      priceCents: 1500,
      durationMinutes: 15,
      turnCount: 0,
      sortOrder: 2,
    },
  ];

  for (const service of services) {
    await prisma.service.upsert({
      where: { id: service.id },
      update: { ...service, active: true },
      create: service,
    });
  }

  const customers = [
    { id: "00000000-0000-0000-0000-000000000301", name: "Sarah Johnson", phone: "+15550002001", email: "sarah@example.com" },
    { id: "00000000-0000-0000-0000-000000000302", name: "Kim Lee", phone: "+15550002002", email: "kim@example.com" },
    { id: "00000000-0000-0000-0000-000000000303", name: "Jessica Miller", phone: "+15550002003", email: null },
  ];

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { phone: customer.phone },
      update: { name: customer.name, email: customer.email },
      create: customer,
    });
  }

  await prisma.auditLog.upsert({
    where: { id: "00000000-0000-0000-0000-000000000901" },
    update: {
      userId: owner.id,
      action: "seed.initialized",
      entityType: "system",
      metadataJson: {
        milestone: "local-first-pos-foundation",
        workersCheckedIn: seededWorkers.length,
      },
    },
    create: {
      id: "00000000-0000-0000-0000-000000000901",
      userId: owner.id,
      action: "seed.initialized",
      entityType: "system",
      metadataJson: {
        milestone: "local-first-pos-foundation",
        workersCheckedIn: seededWorkers.length,
      },
    },
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
