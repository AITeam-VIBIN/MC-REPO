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
  await prisma.signatureHistory.deleteMany();
  await prisma.digitalSignature.deleteMany();
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
  // Authentication: Successful login
  await prisma.auditLog.create({
    data: {
      eventRef: 'AUDIT-AUTH-SUCCESS-001',
      userId: viewerUser.id,
      userSnapshot: { id: viewerUser.id, email: viewerUser.email },
      roleSnapshot: viewerUser.role,
      departmentSnapshot: 'Engineering',
      eventType: 'LOGIN_SUCCESS',
      category: 'AUTHENTICATION',
      action: 'LOGIN',
      description: 'User logged in successfully',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      device: 'Desktop',
      browser: 'Chrome',
      os: 'Windows',
      sessionId: 'session-uuid-001',
      authMethod: 'PASSWORD',
      mfaStatus: 'DISABLED',
      result: 'SUCCESS',
      metadata: { browser: 'Chrome', device: 'Desktop' },
    },
  });

  // Authentication: Failed login
  await prisma.auditLog.create({
    data: {
      eventRef: 'AUDIT-AUTH-FAILED-002',
      userId: null,
      eventType: 'LOGIN_FAILED',
      category: 'AUTHENTICATION',
      action: 'LOGIN',
      description: 'Login failed due to invalid credentials',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      device: 'Laptop',
      browser: 'Safari',
      os: 'macOS',
      authMethod: 'PASSWORD',
      result: 'FAILED',
      metadata: { attemptedEmail: 'unknown@example.com' },
    },
  });

  // Document: Upload
  await prisma.auditLog.create({
    data: {
      eventRef: 'AUDIT-DOC-UPLOAD-003',
      userId: adminUser.id,
      userSnapshot: { id: adminUser.id, email: adminUser.email },
      roleSnapshot: adminUser.role,
      departmentSnapshot: 'Administration',
      eventType: 'DOCUMENT_UPLOADED',
      category: 'DOCUMENT',
      action: 'UPLOAD',
      description: `Document uploaded: ${doc1.name}`,
      referenceType: 'DOCUMENT',
      referenceId: doc1.id,
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      result: 'SUCCESS',
      metadata: { filename: doc1.name, size: doc1.fileSize.toString(), classification: doc1.classification },
    },
  });

  // Document: Download
  await prisma.auditLog.create({
    data: {
      eventRef: 'AUDIT-DOC-DOWNLOAD-004',
      userId: viewerUser.id,
      userSnapshot: { id: viewerUser.id, email: viewerUser.email },
      roleSnapshot: viewerUser.role,
      departmentSnapshot: 'Engineering',
      eventType: 'DOCUMENT_DOWNLOADED',
      category: 'DOCUMENT',
      action: 'DOWNLOAD',
      description: `Document downloaded: ${doc2.name}`,
      referenceType: 'DOCUMENT',
      referenceId: doc2.id,
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      result: 'SUCCESS',
      metadata: { filename: doc2.name, classification: doc2.classification },
    },
  });

  // Checkout: Created (Pending Approval)
  await prisma.auditLog.create({
    data: {
      eventRef: 'AUDIT-CHECKOUT-CREATE-005',
      userId: viewerUser.id,
      userSnapshot: { id: viewerUser.id, email: viewerUser.email },
      roleSnapshot: viewerUser.role,
      departmentSnapshot: 'Engineering',
      eventType: 'CHECKOUT_CREATED',
      category: 'CHECKOUT',
      action: 'CREATE',
      description: 'Checkout request created for document',
      referenceType: 'CHECKOUT',
      referenceId: 'c0000000-0000-0000-0000-000000000001',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      result: 'SUCCESS',
      metadata: { documentId: doc1.id, purpose: 'On-site client architecture review.' },
    },
  });

  // Checkout: Returned
  await prisma.auditLog.create({
    data: {
      eventRef: 'AUDIT-CHECKOUT-RETURN-006',
      userId: viewerUser.id,
      userSnapshot: { id: viewerUser.id, email: viewerUser.email },
      roleSnapshot: viewerUser.role,
      departmentSnapshot: 'Engineering',
      eventType: 'CHECKOUT_RETURNED',
      category: 'CHECKOUT',
      action: 'UPDATE',
      description: 'Checkout document returned and completed',
      referenceType: 'CHECKOUT',
      referenceId: 'c0000000-0000-0000-0000-000000000004',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      previousState: { status: 'CHECKED_OUT' },
      newState: { status: 'RETURNED' },
      result: 'SUCCESS',
      metadata: { returnedTo: 'admin@mitcon.com', condition: 'GOOD' },
    },
  });

  // Approval: Approved
  await prisma.auditLog.create({
    data: {
      eventRef: 'AUDIT-APPROVAL-APPROVE-007',
      userId: adminUser.id,
      userSnapshot: { id: adminUser.id, email: adminUser.email },
      roleSnapshot: adminUser.role,
      departmentSnapshot: 'Administration',
      eventType: 'APPROVAL_GRANTED',
      category: 'APPROVAL',
      action: 'APPROVE',
      description: 'External share request approved',
      referenceType: 'APPROVAL',
      referenceId: 'a0000000-0000-0000-0000-000000000002',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      result: 'SUCCESS',
      metadata: { comments: 'Approved external transfer' },
    },
  });

  // Signature: Verified
  await prisma.auditLog.create({
    data: {
      eventRef: 'AUDIT-SIGNATURE-VERIFY-008',
      userId: adminUser.id,
      userSnapshot: { id: adminUser.id, email: adminUser.email },
      roleSnapshot: adminUser.role,
      departmentSnapshot: 'Administration',
      eventType: 'SIGNATURE_VERIFIED',
      category: 'SIGNATURE',
      action: 'VERIFY',
      description: 'Drawn signature verified successfully',
      referenceType: 'SIGNATURE',
      referenceId: 's1000000-0000-0000-0000-000000000001',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      result: 'SUCCESS',
      metadata: { verificationMethod: 'MANUAL_AUDIT' },
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

  // 11. Seed Digital Signatures
  // A. Checkout signature
  const sig1 = await prisma.digitalSignature.create({
    data: {
      id: 's1000000-0000-0000-0000-000000000001',
      signatureRefNumber: 'SIG-2026-0001',
      signatureType: 'DRAWN',
      status: 'VERIFIED',
      userId: viewerUser.id,
      userSnapshot: 'viewer@mitcon.com',
      departmentSnapshot: 'Engineering',
      referenceType: 'CHECKOUT',
      referenceId: 'c0000000-0000-0000-0000-000000000001',
      bucketName: 'mc-signatures',
      storagePath: 'signatures/viewer/checkout-1.png',
      signatureHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      originalFilename: 'drawn_sig.png',
      mimeType: 'image/png',
      fileSize: 2048n,
      verificationStatus: 'VERIFIED',
      verificationHash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      verifiedBy: adminUser.id,
      verifiedAt: new Date(),
      verificationMethod: 'MANUAL_AUDIT',
    }
  });

  await prisma.signatureHistory.create({
    data: {
      signatureId: sig1.id,
      action: 'CREATED',
      performedBy: viewerUser.id,
    }
  });

  await prisma.signatureHistory.create({
    data: {
      signatureId: sig1.id,
      action: 'VERIFIED',
      performedBy: adminUser.id,
      metadata: { method: 'MANUAL_AUDIT' },
    }
  });

  // B. Return signature
  const sig2 = await prisma.digitalSignature.create({
    data: {
      id: 's1000000-0000-0000-0000-000000000002',
      signatureRefNumber: 'SIG-2026-0002',
      signatureType: 'DRAWN',
      status: 'VERIFIED',
      userId: viewerUser.id,
      userSnapshot: 'viewer@mitcon.com',
      departmentSnapshot: 'Engineering',
      referenceType: 'RETURN',
      referenceId: 'c0000000-0000-0000-0000-000000000004',
      bucketName: 'mc-signatures',
      storagePath: 'signatures/viewer/return-4.png',
      signatureHash: 'f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08a',
      originalFilename: 'drawn_sig_return.png',
      mimeType: 'image/png',
      fileSize: 1850n,
      verificationStatus: 'VERIFIED',
      verifiedBy: adminUser.id,
      verifiedAt: new Date(),
      verificationMethod: 'MANUAL_AUDIT',
    }
  });

  await prisma.signatureHistory.create({
    data: {
      signatureId: sig2.id,
      action: 'CREATED',
      performedBy: viewerUser.id,
    }
  });

  await prisma.signatureHistory.create({
    data: {
      signatureId: sig2.id,
      action: 'VERIFIED',
      performedBy: adminUser.id,
    }
  });

  // C. Approval signature
  const sig3 = await prisma.digitalSignature.create({
    data: {
      id: 's1000000-0000-0000-0000-000000000003',
      signatureRefNumber: 'SIG-2026-0003',
      signatureType: 'UPLOADED',
      status: 'PENDING_VERIFICATION',
      userId: adminUser.id,
      userSnapshot: 'admin@mitcon.com',
      departmentSnapshot: 'Legal',
      referenceType: 'APPROVAL',
      referenceId: 'a0000000-0000-0000-0000-000000000002',
      bucketName: 'mc-signatures',
      storagePath: 'signatures/admin/approval-2.jpg',
      signatureHash: '2c26b46b68ffc68ff99b453c1d30413413422cd15d6c15b0f00a08',
      originalFilename: 'scanned_sig.jpg',
      mimeType: 'image/jpeg',
      fileSize: 45000n,
    }
  });

  await prisma.signatureHistory.create({
    data: {
      signatureId: sig3.id,
      action: 'CREATED',
      performedBy: adminUser.id,
    }
  });

  console.log('Seeded digital signatures');

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
