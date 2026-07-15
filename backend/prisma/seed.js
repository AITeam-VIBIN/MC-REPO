import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up existing database records...');
  await prisma.document.deleteMany();
  await prisma.checkout.deleteMany();
  await prisma.return.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.securityPolicy.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding security policies...');
  const policy = await prisma.securityPolicy.create({
    data: {
      key: "global_policy",
      passwordMinLength: 8,
      requireMfa: false,
      sessionTimeoutMinutes: 30,
      allowedUploadFormats: ["pdf", "docx", "xlsx"],
      autoRejectExpiredCheckouts: false,
      maxCheckoutDurationDays: 30
    }
  });

  console.log('Seeding core users...');
  const users = [
    {
      id: "usr-1",
      name: "Sarah Jenkins",
      email: "super1@bitcoin-credentials.org",
      role: "super-admin",
      createdAt: new Date(),
      status: "active"
    },
    {
      id: "usr-2",
      name: "Michael Chang",
      email: "admin1@bitcoin-credentials.org",
      role: "admin",
      createdAt: new Date(),
      status: "active"
    },
    {
      id: "usr-3",
      name: "Robert Downey",
      email: "user1@bitcoin-credentials.org",
      role: "user",
      createdAt: new Date(),
      status: "active"
    },
    {
      id: "usr-4",
      name: "Satoshi Nakamoto",
      email: "dev1@bitcoin-credentials.org",
      role: "developer",
      createdAt: new Date(),
      status: "active"
    }
  ];

  for (const u of users) {
    await prisma.user.create({ data: u });
  }

  console.log('Seeding standard document library...');
  const docs = [
    {
      id: "doc-1",
      documentId: "DOC-HR-002",
      documentName: "HR General Policy & Employee Handbook",
      owner: "Sarah Jenkins",
      dateUploaded: new Date(),
      expiryDate: "2027-12-31",
      filePath: "hr/policy/handbook.pdf",
      status: "Available",
      uploadedBy: "Sarah Jenkins",
      client: "Internal Core"
    },
    {
      id: "doc-2",
      documentId: "DOC-ENG-2026-001",
      documentName: "System Architectural Design Blueprint",
      owner: "Robert Downey",
      dateUploaded: new Date(),
      expiryDate: "2028-06-30",
      filePath: "eng/specs/blueprint.pdf",
      status: "Available",
      uploadedBy: "Robert Downey",
      client: "Internal Core"
    },
    {
      id: "doc-3",
      documentId: "DOC-LEG-2026-001",
      documentName: "Standard Non-Disclosure Agreement Document",
      owner: "Michael Chang",
      dateUploaded: new Date(),
      expiryDate: "2029-01-01",
      filePath: "legal/agreements/nda.docx",
      status: "Available",
      uploadedBy: "Michael Chang",
      client: "Internal Core"
    }
  ];

  for (const d of docs) {
    await prisma.document.create({ data: d });
  }

  console.log('Seeding initial notifications...');
  await prisma.notification.create({
    data: {
      id: "not-1",
      title: "System Seeding Active",
      message: "Welcome to MITCON Credential Digital File Storage System (BCD-FSS). The secure node is fully database-synchronized.",
      status: "unread",
      timestamp: new Date()
    }
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
