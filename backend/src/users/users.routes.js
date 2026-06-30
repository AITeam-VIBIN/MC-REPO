import { Router } from 'express';
import { z } from 'zod';
import UsersController from '../controllers/users.controller.js';
import { requireAuth, requireRole } from '../middleware/index.js';

const router = Router();
const usersController = new UsersController();

// =========================================================================
// 1. Zod Validation Schemas
// =========================================================================

/**
 * Validation schema for creating a user account.
 */
export const createUserSchema = z.object({
  body: z.object({
    email: z.string().trim().email('Invalid email address format.'),
    name: z.string().trim().min(1, 'Name is required.').optional(),
    role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']).default('VIEWER'),
  }),
});

/**
 * Validation schema for updating user profile parameters.
 */
export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'User ID parameter is required.'),
  }),
  body: z.object({
    name: z.string().trim().min(1, 'Name cannot be empty.').optional(),
    role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']).optional(),
  }),
});

/**
 * Validation schema for listing users.
 */
export const listUsersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING']).optional(),
  }),
});

/**
 * Validation schema for route operations targeting a specific user ID.
 */
export const userIdParamSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'User ID parameter is required.'),
  }),
});


// =========================================================================
// 2. Request Validation Middleware
// =========================================================================

/**
 * Utility validation handler middleware.
 * Binds Zod parser schemas to Route request elements.
 * 
 * @param {import('zod').ZodSchema} schema - Zod compilation target schema
 * @returns {import('express').RequestHandler}
 */
const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data payload.',
        details: err.errors,
      },
    });
  }
};


// =========================================================================
// 3. Routing Map Definitions
// =========================================================================

// All users routes require authentication and administrator privileges
router.use(requireAuth);
router.use(requireRole(['ADMIN']));

/**
 * POST /api/v1/users
 * Creates a new user profile.
 */
router.post('/', validate(createUserSchema), usersController.createUser);

/**
 * GET /api/v1/users
 * Retrieves a paginated list of user accounts.
 */
router.get('/', validate(listUsersSchema), usersController.listUsers);

/**
 * GET /api/v1/users/:id
 * Fetches profile details for a specific user.
 */
router.get('/:id', validate(userIdParamSchema), usersController.getUser);

/**
 * PUT /api/v1/users/:id
 * Updates target details of a specific user.
 */
router.put('/:id', validate(updateUserSchema), usersController.updateUser);

/**
 * POST /api/v1/users/:id/activate
 * Sets the active status configuration flag to ACTIVE.
 */
router.post('/:id/activate', validate(userIdParamSchema), usersController.activateUser);

/**
 * POST /api/v1/users/:id/deactivate
 * Sets the active status configuration flag to INACTIVE.
 */
router.post('/:id/deactivate', validate(userIdParamSchema), usersController.deactivateUser);

export default router;
