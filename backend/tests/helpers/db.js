import { prisma } from '../../src/config/database.js';

/**
 * Cleans up the test database tables in correct dependency order.
 * 
 * @async
 * @function cleanupDb
 * @returns {Promise<void>}
 */
export async function cleanupDb() {
  try {
    await prisma.signatureHistory.deleteMany({});
    await prisma.digitalSignature.deleteMany({});
    await prisma.checkoutMovement.deleteMany({});
    await prisma.checkout.deleteMany({});
    await prisma.approvalHistory.deleteMany({});
    await prisma.approvalStep.deleteMany({});
    await prisma.approvalRequest.deleteMany({});
    await prisma.fileVersion.deleteMany({});
    await prisma.document.deleteMany({});
    await prisma.folderPermission.deleteMany({});
    await prisma.folder.deleteMany({});
    await prisma.vault.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.department.deleteMany({});
  } catch (err) {
    console.error('[DB Cleanup Error]:', err);
  }
}
