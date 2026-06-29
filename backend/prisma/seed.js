import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed initial administrative and test user roles into PostgreSQL.
 * @returns {Promise<void>}
 */
async function main() {
  console.log('Seeding database with test users...');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@mitcon-credentia.com' },
    update: {},
    create: {
      id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      email: 'admin@mitcon-credentia.com',
      role: 'ADMIN',
    },
  });

  const uploader = await prisma.user.upsert({
    where: { email: 'uploader@mitcon-credentia.com' },
    update: {},
    create: {
      id: 'f1e2d3c4-b5a6-0f9e-8d7c-6b5a4f3e2d1c',
      email: 'uploader@mitcon-credentia.com',
      role: 'UPLOADER',
    },
  });

  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@mitcon-credentia.com' },
    update: {},
    create: {
      id: '9f8e7d6c-5b4a-3f2e-1d0c-9b8a7f6e5d4c',
      email: 'viewer@mitcon-credentia.com',
      role: 'VIEWER',
    },
  });

  console.log('Seeding completed. Users created:', {
    admin: admin.email,
    uploader: uploader.email,
    viewer: viewer.email,
  });
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
