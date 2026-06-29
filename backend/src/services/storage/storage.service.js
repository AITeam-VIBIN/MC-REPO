import { supabaseAdmin } from '../../config/supabase.js';

/**
 * Storage Service Infrastructure Wrapper.
 * Provides abstraction for interacting with Supabase Storage buckets.
 * Executes administrative storage tasks (generating signed URLs, deleting objects, moving objects)
 * using the privileged Service Role Admin client.
 */
export class StorageService {
  /**
   * Generates a signed URL to allow direct uploads from client applications.
   * Safe upload window defaults to 5 minutes (300 seconds).
   * 
   * @async
   * @static
   * @function generateUploadUrl
   * @param {string} bucket - Target storage bucket identifier
   * @param {string} path - Remote file destination key path
   * @param {number} [expiresInSeconds=300] - Expiry threshold for the upload window
   * @throws {Error} If Supabase SDK returns a client query exception
   * @returns {Promise<{signedUrl: string, token: string, path: string}>} Upload payload options
   */
  static async generateUploadUrl(bucket, path, expiresInSeconds = 300) {
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUploadUrl(path, { expiresIn: expiresInSeconds });

      if (error) {
        throw error;
      }
      return data;
    } catch (err) {
      console.error(`[Storage Service Error] generateUploadUrl:`, err);
      throw new Error(`Storage error generating signed upload target: ${err.message}`);
    }
  }

  /**
   * Generates a read-only signed URL to retrieve private objects.
   * Safe access window defaults to 15 minutes (900 seconds).
   * 
   * @async
   * @static
   * @function generateDownloadUrl
   * @param {string} bucket - Source storage bucket identifier
   * @param {string} path - Remote file source key path
   * @param {number} [expiresInSeconds=900] - Expiry threshold for the download window
   * @throws {Error} If Supabase SDK returns a client query exception
   * @returns {Promise<{signedUrl: string}>} Download payload options
   */
  static async generateDownloadUrl(bucket, path, expiresInSeconds = 900) {
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(path, expiresInSeconds);

      if (error) {
        throw error;
      }
      return data;
    } catch (err) {
      console.error(`[Storage Service Error] generateDownloadUrl:`, err);
      throw new Error(`Storage error generating signed download target: ${err.message}`);
    }
  }

  /**
   * Deletes a binary object from the target bucket.
   * 
   * @async
   * @static
   * @function deleteObject
   * @param {string} bucket - Target storage bucket identifier
   * @param {string} path - Remote file key path to delete
   * @throws {Error} If Supabase SDK returns a client query exception
   * @returns {Promise<void>} Resolves on successful deletion
   */
  static async deleteObject(bucket, path) {
    try {
      const { error } = await supabaseAdmin.storage
        .from(bucket)
        .remove([path]);

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error(`[Storage Service Error] deleteObject:`, err);
      throw new Error(`Storage error deleting object at path: ${err.message}`);
    }
  }

  /**
   * Moves or renames an object from one path to another inside the same bucket.
   * 
   * @async
   * @static
   * @function moveObject
   * @param {string} bucket - Target storage bucket identifier
   * @param {string} fromPath - Source key path
   * @param {string} toPath - Destination key path
   * @throws {Error} If Supabase SDK returns a client query exception
   * @returns {Promise<void>} Resolves on successful transfer
   */
  static async moveObject(bucket, fromPath, toPath) {
    try {
      const { error } = await supabaseAdmin.storage
        .from(bucket)
        .move(fromPath, toPath);

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error(`[Storage Service Error] moveObject:`, err);
      throw new Error(`Storage error moving object from ${fromPath} to ${toPath}: ${err.message}`);
    }
  }
}

export default StorageService;
