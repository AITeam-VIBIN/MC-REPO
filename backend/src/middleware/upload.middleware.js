import multer from 'multer';
import { STORAGE_BUCKETS } from '../config/supabase.js';
import {
  validateFileExtension,
  validateMimeType,
  validateFileSize,
  validateFilename
} from '../utils/storage.util.js';

// Configure memory storage engine
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // Hard limit of 50MB per file for safety
  }
});

/**
 * Validates file constraints (name, extension, type, size) inside the upload middleware pipeline.
 * 
 * @function validateUploadedFile
 * @param {Express.Multer.File} file - Multer parsed file object
 * @throws {Error} If validation constraints are violated
 */
function validateUploadedFile(file) {
  if (!file) {
    throw new Error('No file payload was transmitted in the upload request.');
  }

  // 1. Validate naming rules
  if (!validateFilename(file.originalname)) {
    throw new Error(`Filename contains invalid characters: "${file.originalname}". Chars \\/:*?"<>| are not allowed.`);
  }

  // 2. Validate format extension
  if (!validateFileExtension(file.originalname, STORAGE_BUCKETS.DOCUMENTS)) {
    throw new Error(`File format is not supported for filename: "${file.originalname}". Supported formats: PDF, DOCX, XLSX, PPTX, JPG, PNG, ZIP`);
  }

  // 3. Validate MIME type
  if (!validateMimeType(file.mimetype, STORAGE_BUCKETS.DOCUMENTS)) {
    throw new Error(`File MIME type is invalid or unsupported: "${file.mimetype}"`);
  }

  // 4. Validate file size
  if (!validateFileSize(file.size, STORAGE_BUCKETS.DOCUMENTS)) {
    throw new Error(`File size is too large (limit is 50MB). File size: ${file.size} bytes.`);
  }
}

/**
 * Middleware handling single file uploads under form field 'file'.
 */
export const uploadSingle = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'File size exceeds maximum allowed upload threshold (50MB).'
          }
        });
      }
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: err.message
        }
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'No file payload was transmitted under the field name "file".'
          }
        });
      }
      validateUploadedFile(req.file);
      next();
    } catch (validationErr) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: validationErr.message
        }
      });
    }
  });
};

/**
 * Middleware handling multiple file uploads under fields 'files' or 'file'.
 */
export const uploadMultiple = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'One of the files exceeds maximum allowed upload threshold (50MB).'
          }
        });
      }
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: err.message
        }
      });
    }

    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'No file payloads found in the upload request.'
          }
        });
      }

      for (const file of req.files) {
        validateUploadedFile(file);
      }
      next();
    } catch (validationErr) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: validationErr.message
        }
      });
    }
  });
};

export default {
  uploadSingle,
  uploadMultiple,
};
