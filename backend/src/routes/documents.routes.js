import { Router } from 'express';
import { prisma } from '../config/database.js';
import { getIO } from '../config/socket.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const documents = await prisma.document.findMany();
    res.status(200).json(documents);
  } catch (err) {
    console.error("Error reading documents from PostgreSQL:", err);
    res.status(500).json({ message: "Failed to read documents." });
  }
});

router.post('/', async (req, res) => {
  const doc = req.body;

  if (!doc.documentId || !doc.documentId.trim()) {
    return res.status(400).json({ message: "Document ID Code is required." });
  }
  if (!doc.documentName || !doc.documentName.trim()) {
    return res.status(400).json({ message: "Document Name is required." });
  }

  try {
    const newDocId = `doc-${Date.now()}`;
    const newDoc = await prisma.document.create({
      data: {
        id: newDocId,
        documentId: doc.documentId.trim(),
        documentName: doc.documentName.trim(),
        owner: doc.uploadedBy || "System",
        dateUploaded: new Date(),
        expiryDate: doc.expiryDate,
        filePath: `secure/repository/${doc.documentId.trim().toLowerCase()}.pdf`,
        status: "Available",
        uploadedBy: doc.uploadedBy || "System",
        client: doc.client || "Internal Core"
      }
    });

    // Notify admins
    const notification = await prisma.notification.create({
      data: {
        id: `not-${Date.now()}`,
        title: "New Document Uploaded",
        message: `${newDoc.uploadedBy} uploaded a new document ${newDoc.documentId} (${newDoc.documentName}).`,
        status: "unread",
        timestamp: new Date()
      }
    });

    const io = getIO();
    if (io) {
      io.emit('notification:new', notification);
    }

    res.status(200).json(newDoc);
  } catch (err) {
    console.error("Error creating document in PostgreSQL:", err);
    if (err.code === 'P2002') {
      return res.status(400).json({ message: `A document with ID code "${doc.documentId}" already exists in the system database.` });
    }
    res.status(500).json({ message: err.message || "Failed to create document record." });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return res.status(404).json({ message: "Document not found." });
    }

    await prisma.document.delete({ where: { id } });
    res.sendStatus(204);
  } catch (err) {
    console.error("Error deleting document from PostgreSQL:", err);
    res.status(500).json({ message: "Failed to delete document." });
  }
});

router.post('/restore-seed', async (req, res) => {
  try {
    await prisma.document.deleteMany();

    const initialDocuments = [
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

    for (const d of initialDocuments) {
      await prisma.document.create({ data: d });
    }

    res.status(200).json({ message: "Seed documents successfully restored." });
  } catch (err) {
    console.error("Error restoring documents seed in PostgreSQL:", err);
    res.status(500).json({ message: "Failed to restore seed." });
  }
});

export default router;
