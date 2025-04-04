const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log(`Seeding roles...`);
  const adminRole = await prisma.role.upsert({
    where: { role_name: 'ADMIN' }, // Use a unique field to check if it exists
    update: {}, // Nothing to update if it exists
    create: {
      role_name: 'ADMIN',
    },
  });

  const userRole = await prisma.role.upsert({
    where: { role_name: 'USER' },
    update: {},
    create: {
      role_name: 'USER',
    },
  });
  console.log(`Roles seeded: ${adminRole.role_name}, ${userRole.role_name}`);

  console.log(`Seeding finished.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // Close Prisma Client connection
    await prisma.$disconnect();
  });