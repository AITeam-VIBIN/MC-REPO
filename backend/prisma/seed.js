import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // 1. Seed Departments
  const deptLegal = await prisma.department.upsert({
    where: { name: 'Legal' },
    update: {},
    create: { name: 'Legal' },
  });
  const deptEngineering = await prisma.department.upsert({
    where: { name: 'Engineering' },
    update: {},
    create: { name: 'Engineering' },
  });
  console.log('Seeded departments');

  // 2. Seed Users
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@mitcon.com' },
    update: { departmentId: deptLegal.id },
    create: {
      id: 'user-admin-123',
      email: 'admin@mitcon.com',
      role: 'ADMIN',
      departmentId: deptLegal.id,
    },
  });
  const viewerUser = await prisma.user.upsert({
    where: { email: 'viewer@mitcon.com' },
    update: { departmentId: deptEngineering.id },
    create: {
      id: 'user-viewer-123',
      email: 'viewer@mitcon.com',
      role: 'VIEWER',
      departmentId: deptEngineering.id,
    },
  });
  console.log('Seeded users');

  // 3. Seed Vaults & Folders (Clean previous structures first)
  await prisma.checkoutMovement.deleteMany();
  await prisma.checkout.deleteMany();
  await prisma.approvalHistory.deleteMany();
  await prisma.approvalStep.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.fileVersion.deleteMany();
  await prisma.document.deleteMany();
  await prisma.folderPermission.deleteMany();
  await prisma.folder.deleteMany();
  await prisma.vault.deleteMany();
  console.log('Cleaned up previous database records');

  // Seed Vaults
  const engineeringVault = await prisma.vault.create({
    data: {
      name: 'Engineering Vault',
      description: 'Primary storage for specifications and architecture designs',
      type: 'DEPARTMENT',
      ownerId: viewerUser.id,
      departmentId: deptEngineering.id,
    },
  });

  const legalVault = await prisma.vault.create({
    data: {
      name: 'Legal Vault',
      description: 'Highly confidential legal files and agreement templates',
      type: 'DEPARTMENT',
      ownerId: adminUser.id,
      departmentId: deptLegal.id,
    },
  });
  console.log('Seeded vaults');

  // Seed Folders
  const folderSpecs = await prisma.folder.create({
    data: {
      name: 'Technical Specifications',
      parentId: null,
      vaultId: engineeringVault.id,
      departmentId: deptEngineering.id,
      ownerId: viewerUser.id,
      path: '/technical-specifications',
    },
  });

  const folderAgreements = await prisma.folder.create({
    data: {
      name: 'Client Agreements',
      parentId: null,
      vaultId: legalVault.id,
      departmentId: deptLegal.id,
      ownerId: adminUser.id,
      path: '/client-agreements',
    },
  });
  console.log('Seeded folders');

  // 4. Seed Documents
  const doc1 = await prisma.document.create({
    data: {
      name: 'Arch-spec-v1.pdf',
      documentNumber: 'DOC-ENG-2026-001',
      description: 'System Architectural Design Blueprint',
      tags: ['specification', 'architecture', 'blueprint'],
      folderId: folderSpecs.id,
      vaultId: engineeringVault.id,
      departmentId: deptEngineering.id,
      ownerId: viewerUser.id,
      storageProvider: 'SUPABASE',
      storageBucket: 'mc-documents',
      storagePath: 'engineering/specs/Arch-spec-v1.pdf',
      mimeType: 'application/pdf',
      fileSize: 4589201n,
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      classification: 'INTERNAL',
      status: 'ACTIVE',
      version: 1,
    },
  });

  const doc2 = await prisma.document.create({
    data: {
      name: 'NDA-Template.docx',
      documentNumber: 'DOC-LEG-2026-001',
      description: 'Standard Non-Disclosure Agreement Document',
      tags: ['nda', 'agreement', 'template'],
      folderId: folderAgreements.id,
      vaultId: legalVault.id,
      departmentId: deptLegal.id,
      ownerId: adminUser.id,
      storageProvider: 'SUPABASE',
      storageBucket: 'mc-documents',
      storagePath: 'legal/agreements/NDA-Template.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSize: 1048576n,
      checksum: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      classification: 'CONFIDENTIAL',
      status: 'DRAFT',
      version: 1,
      isLocked: true,
      lockedById: adminUser.id,
      lockedAt: new Date(),
    },
  });
  console.log('Seeded documents');

  // 5. Seed File Versions
  await prisma.fileVersion.create({
    data: {
      documentId: doc1.id,
      version: 1,
      filePath: 'engineering/specs/Arch-spec-v1.pdf',
      changeLog: 'Initial architectural draft creation',
      createdBy: viewerUser.id,
    },
  });

  await prisma.fileVersion.create({
    data: {
      documentId: doc2.id,
      version: 1,
      filePath: 'legal/agreements/NDA-Template.docx',
      changeLog: 'Created standard template',
      createdBy: adminUser.id,
    },
  });
  console.log('Seeded file versions');

  // 6. Seed Folder Permissions
  await prisma.folderPermission.create({
    data: {
      folderId: folderSpecs.id,
      userId: viewerUser.id,
      permission: 'ADMIN',
    },
  });

  await prisma.folderPermission.create({
    data: {
      folderId: folderAgreements.id,
      userId: adminUser.id,
      permission: 'ADMIN',
    },
  });
  console.log('Seeded folder permissions');

  // 7. Old Seed Approval Requests placeholder removed (Seeded as polymorphic workflows in step 10)

  // 8. Seed Audit Logs
  await prisma.auditLog.create({
    data: {
      action: 'DOCUMENT_UPLOADED',
      userId: viewerUser.id,
      documentId: doc1.id,
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      payload: { action: 'upload', size: 4589201 },
    },
  });
  await prisma.auditLog.create({
    data: {
      action: 'DOCUMENT_LOCKED',
      userId: adminUser.id,
      documentId: doc2.id,
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      payload: { action: 'lock' },
    },
  });
  console.log('Seeded audit logs');

  // 9. Seed Checkouts
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  await prisma.checkout.create({
    data: {
      id: 'c0000000-0000-0000-0000-000000000001',
      documentId: doc1.id,
      documentVersionId: 'ver-old-1',
      documentNameSnapshot: doc1.name,
      classificationSnapshot: doc1.classification,
      requestedById: viewerUser.id,
      employeeId: 'EMP-Viewer',
      employeeName: 'Viewer User',
      department: 'Engineering',
      designation: 'Architect Specifier',
      destination: 'MITCON Client Site A',
      locationAddress: '123 Main St, Tokyo, Japan',
      purposeOfRemoval: 'On-site client architecture review.',
      status: 'PENDING_APPROVAL',
    },
  });

  await prisma.checkout.create({
    data: {
      id: 'c0000000-0000-0000-0000-000000000002',
      documentId: doc1.id,
      documentVersionId: 'ver-old-1',
      documentNameSnapshot: doc1.name,
      classificationSnapshot: doc1.classification,
      requestedById: viewerUser.id,
      employeeId: 'EMP-Viewer',
      employeeName: 'Viewer User',
      department: 'Engineering',
      designation: 'Architect Specifier',
      destination: 'MITCON Client Site A',
      locationAddress: '123 Main St, Tokyo, Japan',
      purposeOfRemoval: 'On-site client architecture review.',
      status: 'APPROVED',
      approvedById: adminUser.id,
      approvedAt: new Date(),
    },
  });

  await prisma.checkout.create({
    data: {
      id: 'c0000000-0000-0000-0000-000000000003',
      documentId: doc1.id,
      documentVersionId: 'ver-old-1',
      documentNameSnapshot: doc1.name,
      classificationSnapshot: doc1.classification,
      requestedById: viewerUser.id,
      employeeId: 'EMP-Viewer',
      employeeName: 'Viewer User',
      department: 'Engineering',
      designation: 'Architect Specifier',
      destination: 'MITCON Client Site A',
      locationAddress: '123 Main St, Tokyo, Japan',
      purposeOfRemoval: 'On-site client architecture review.',
      status: 'CHECKED_OUT',
      approvedById: adminUser.id,
      approvedAt: new Date(),
      checkoutDate: new Date(),
      expectedReturnDate: sevenDaysFromNow,
    },
  });

  await prisma.checkout.create({
    data: {
      id: 'c0000000-0000-0000-0000-000000000004',
      documentId: doc1.id,
      documentVersionId: 'ver-old-1',
      documentNameSnapshot: doc1.name,
      classificationSnapshot: doc1.classification,
      requestedById: viewerUser.id,
      employeeId: 'EMP-Viewer',
      employeeName: 'Viewer User',
      department: 'Engineering',
      designation: 'Architect Specifier',
      destination: 'MITCON Client Site A',
      locationAddress: '123 Main St, Tokyo, Japan',
      purposeOfRemoval: 'On-site client architecture review.',
      status: 'RETURNED',
      approvedById: adminUser.id,
      approvedAt: new Date(),
      checkoutDate: new Date(),
      expectedReturnDate: sevenDaysFromNow,
      returnStatus: 'Returned and verified',
      returnedDate: new Date(),
      returnedTo: 'admin@mitcon.com',
      conditionOnReturn: 'GOOD',
      returnNotes: 'Returned in perfect physical condition.',
    },
  });
  console.log('Seeded checkout records');

  // 10. Seed Polymorphic Approval Workflow Records
  const appReq1 = await prisma.approvalRequest.create({
    data: {
      id: 'a0000000-0000-0000-0000-000000000001',
      referenceType: 'CHECKOUT',
      referenceId: 'c0000000-0000-0000-0000-000000000001',
      title: 'Checkout Request for Arch-spec-v1.pdf',
      description: 'Physical audit copy requested by Viewer User',
      reason: 'Standard process verification review.',
      requesterId: viewerUser.id,
      requesterName: 'Viewer User',
      requesterDepartment: 'Engineering',
      requesterDesignation: 'Architect Specifier',
      currentStep: 1,
      totalSteps: 1,
      currentApproverId: adminUser.id,
      approvalLevel: 'ADMIN',
      priority: 'NORMAL',
      status: 'PENDING',
    }
  });

  await prisma.approvalStep.create({
    data: {
      approvalRequestId: appReq1.id,
      stepNumber: 1,
      approverId: adminUser.id,
      approverRole: 'ADMIN',
      status: 'PENDING',
      approverName: 'Admin User',
    }
  });

  await prisma.approvalHistory.create({
    data: {
      approvalRequestId: appReq1.id,
      action: 'CREATED',
      performedBy: viewerUser.id,
      previousState: 'DRAFT',
      newState: 'PENDING',
      remarks: 'Draft request generated.',
    }
  });

  await prisma.approvalHistory.create({
    data: {
      approvalRequestId: appReq1.id,
      action: 'SUBMITTED',
      performedBy: viewerUser.id,
      previousState: 'PENDING',
      newState: 'PENDING',
      remarks: 'Submitted for manager/admin approval.',
    }
  });

  const appReq2 = await prisma.approvalRequest.create({
    data: {
      id: 'a0000000-0000-0000-0000-000000000002',
      referenceType: 'EXTERNAL_SHARE',
      referenceId: 'share-999',
      title: 'External Share of NDAs',
      description: 'Sharing standard agreement template with external partner',
      reason: 'Partner collaboration prep.',
      requesterId: viewerUser.id,
      requesterName: 'Viewer User',
      requesterDepartment: 'Engineering',
      requesterDesignation: 'Architect Specifier',
      currentStep: 1,
      totalSteps: 1,
      currentApproverId: adminUser.id,
      approvalLevel: 'ADMIN',
      priority: 'HIGH',
      status: 'APPROVED',
    }
  });

  await prisma.approvalStep.create({
    data: {
      approvalRequestId: appReq2.id,
      stepNumber: 1,
      approverId: adminUser.id,
      approverRole: 'ADMIN',
      status: 'APPROVED',
      decisionDate: new Date(),
      comments: 'Approved external transfer',
      actionTaken: 'APPROVED',
      approverName: 'Admin User',
    }
  });

  await prisma.approvalHistory.create({
    data: {
      approvalRequestId: appReq2.id,
      action: 'CREATED',
      performedBy: viewerUser.id,
      previousState: 'DRAFT',
      newState: 'PENDING',
    }
  });

  await prisma.approvalHistory.create({
    data: {
      approvalRequestId: appReq2.id,
      action: 'APPROVED',
      performedBy: adminUser.id,
      previousState: 'PENDING',
      newState: 'APPROVED',
      remarks: 'Approved by admin.',
    }
  });

  const appReq3 = await prisma.approvalRequest.create({
    data: {
      id: 'a0000000-0000-0000-0000-000000000003',
      referenceType: 'DOCUMENT',
      referenceId: doc2.id,
      title: 'Classification Override Request',
      description: 'Downgrading classification from CONFIDENTIAL to PUBLIC',
      reason: 'Public marketing request.',
      requesterId: viewerUser.id,
      requesterName: 'Viewer User',
      requesterDepartment: 'Engineering',
      requesterDesignation: 'Architect Specifier',
      currentStep: 1,
      totalSteps: 1,
      currentApproverId: adminUser.id,
      approvalLevel: 'ADMIN',
      priority: 'URGENT',
      status: 'REJECTED',
    }
  });

  await prisma.approvalStep.create({
    data: {
      approvalRequestId: appReq3.id,
      stepNumber: 1,
      approverId: adminUser.id,
      approverRole: 'ADMIN',
      status: 'REJECTED',
      decisionDate: new Date(),
      comments: 'Rejected. Violates security compliance parameters.',
      actionTaken: 'REJECTED',
      approverName: 'Admin User',
    }
  });

  await prisma.approvalHistory.create({
    data: {
      approvalRequestId: appReq3.id,
      action: 'REJECTED',
      performedBy: adminUser.id,
      previousState: 'PENDING',
      newState: 'REJECTED',
      remarks: 'Violates compliance parameters.',
    }
  });

  const appReq4 = await prisma.approvalRequest.create({
    data: {
      id: 'a0000000-0000-0000-0000-000000000004',
      referenceType: 'USER_ACCESS',
      referenceId: 'access-req-002',
      title: 'Confidential Repository Read Privilege Request',
      description: 'Granting read permissions to Engineering team lead',
      reason: 'Required for technical specs design overview.',
      requesterId: viewerUser.id,
      requesterName: 'Viewer User',
      requesterDepartment: 'Engineering',
      requesterDesignation: 'Architect Specifier',
      currentStep: 2,
      totalSteps: 3,
      currentApproverId: adminUser.id,
      approvalLevel: 'ADMIN',
      priority: 'NORMAL',
      status: 'IN_PROGRESS',
    }
  });

  await prisma.approvalStep.create({
    data: {
      approvalRequestId: appReq4.id,
      stepNumber: 1,
      approverId: adminUser.id,
      approverRole: 'MANAGER',
      status: 'APPROVED',
      decisionDate: new Date(),
      comments: 'Manager verification completed.',
      actionTaken: 'APPROVED',
      approverName: 'Admin User',
    }
  });

  await prisma.approvalStep.create({
    data: {
      approvalRequestId: appReq4.id,
      stepNumber: 2,
      approverId: adminUser.id,
      approverRole: 'ADMIN',
      status: 'PENDING',
      approverName: 'Admin User',
    }
  });

  await prisma.approvalStep.create({
    data: {
      approvalRequestId: appReq4.id,
      stepNumber: 3,
      approverId: adminUser.id,
      approverRole: 'VP',
      status: 'PENDING',
      approverName: 'Admin User',
    }
  });

  await prisma.approvalHistory.create({
    data: {
      approvalRequestId: appReq4.id,
      action: 'CREATED',
      performedBy: viewerUser.id,
      previousState: 'DRAFT',
      newState: 'PENDING',
    }
  });

  await prisma.approvalHistory.create({
    data: {
      approvalRequestId: appReq4.id,
      action: 'APPROVED',
      performedBy: adminUser.id,
      previousState: 'PENDING',
      newState: 'IN_PROGRESS',
      remarks: 'Step 1 approved.',
    }
  });

  console.log('Seeded polymorphic workflow approval requests');

  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
