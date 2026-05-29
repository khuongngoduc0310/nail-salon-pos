import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: "owner@example.com" },
    update: {
      name: "Owner",
      role: "owner",
      active: true,
      passwordHash: "dev-password-placeholder",
      pinHash: "dev-pin-placeholder",
    },
    create: {
      name: "Owner",
      email: "owner@example.com",
      role: "owner",
      passwordHash: "dev-password-placeholder",
      pinHash: "dev-pin-placeholder",
    },
  });

  const workers = [
    { name: "Amy", email: "amy@example.com", commissionRate: "0.6000", sortOrder: 1 },
    { name: "Bella", email: "bella@example.com", commissionRate: "0.5500", sortOrder: 2 },
    { name: "Cindy", email: "cindy@example.com", commissionRate: "0.5000", sortOrder: 3 },
  ];

  for (const worker of workers) {
    const user = await prisma.user.upsert({
      where: { email: worker.email },
      update: {},
      create: {
        name: worker.name,
        email: worker.email,
        role: "worker",
        pinHash: "dev-pin-placeholder",
      },
    });

    await prisma.worker.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        displayName: worker.name,
        commissionRate: worker.commissionRate,
        sortOrder: worker.sortOrder,
      },
    });
  }

  const manicure = await prisma.serviceCategory.upsert({
    where: { id: "00000000-0000-0000-0000-000000000101" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000101",
      name: "Manicure",
      sortOrder: 1,
    },
  });

  const pedicure = await prisma.serviceCategory.upsert({
    where: { id: "00000000-0000-0000-0000-000000000102" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000102",
      name: "Pedicure",
      sortOrder: 2,
    },
  });

  const services = [
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

  for (const service of services) {
    await prisma.service.upsert({
      where: { id: service.id },
      update: {},
      create: service,
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: owner.id,
      action: "seed.initialized",
      entityType: "system",
      metadataJson: { milestone: "typescript-monorepo-foundation" },
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
