import { Router } from 'express';
import { z } from 'zod';
import {
  DevicesController,
  IdentityActivityController,
  PermissionsController,
  RolesController,
  SessionsController,
} from '../controllers/security.controller.js';
import { requireAuth, requireSession, requireRole } from '../middleware/index.js';

const mainRouter = Router();

const devicesController = new DevicesController();
const identityActivityController = new IdentityActivityController();
const permissionsController = new PermissionsController();
const rolesController = new RolesController();
const sessionsController = new SessionsController();

// =========================================================================
// 1. Zod Validation Schemas
// =========================================================================

// Devices Schemas
export const trustDeviceSchema = z.object({
  params: z.object({
    id: z.string().uuid('Device ID parameter must be a valid UUID.'),
  }),
  body: z.object({
    isTrusted: z.boolean({ required_error: 'isTrusted boolean flag is required.' }),
  }),
});

export const revokeDeviceSchema = z.object({
  params: z.object({
    id: z.string().uuid('Device ID parameter must be a valid UUID.'),
  }),
});

// Permissions Schemas
export const createPermissionSchema = z.object({
  body: z.object({
    name: z.string().trim().min(3, 'Permission name must be at least 3 characters long.'),
    description: z.string().trim().max(255, 'Description cannot exceed 255 characters.').optional(),
  }),
});

export const updatePermissionSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Permission ID parameter is required.'),
  }),
  body: z.object({
    description: z.string().trim().max(255, 'Description cannot exceed 255 characters.'),
  }),
});

export const assignPermissionSchema = z.object({
  body: z.object({
    roleId: z.string().trim().min(1, 'Target Role ID is required.'),
    permissionName: z.string().trim().min(1, 'Permission name is required.'),
  }),
});

export const listPermissionsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  }),
});

export const permissionIdParamSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Permission ID parameter is required.'),
  }),
});

// Roles Schemas
export const createRoleSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Role name must be at least 2 characters long.'),
    description: z.string().trim().max(255, 'Description cannot exceed 255 characters.').optional(),
    permissions: z.array(z.string().trim().min(1)).min(1, 'Role must contain at least one permission.'),
  }),
});

export const updateRoleSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Role ID parameter is required.'),
  }),
  body: z.object({
    description: z.string().trim().max(255).optional(),
    permissions: z.array(z.string().trim().min(1)).optional(),
  }),
});

export const assignRoleSchema = z.object({
  body: z.object({
    userId: z.string().uuid('Target User ID must be a valid UUID format.'),
    roleName: z.string().trim().min(1, 'Role name is required.'),
  }),
});

export const listRolesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  }),
});

export const roleIdParamSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Role ID parameter is required.'),
  }),
});

// Sessions Schemas
export const createSessionSchema = z.object({
  body: z.object({
    token: z.string().trim().min(1, 'Refresh token sequence is required.'),
  }),
});

export const revokeSessionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Session ID must be a valid UUID format.'),
  }),
});

export const listSessionsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  }).optional(),
});

// Identity Activity Schemas
export const listActivitiesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  }).optional(),
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

// Devices Sub-Router
const devicesRouter = Router();
devicesRouter.use(requireAuth);
devicesRouter.use(requireSession);

devicesRouter.get('/', devicesController.listDevices);
devicesRouter.patch('/:id/trust', validate(trustDeviceSchema), devicesController.trustDevice);
devicesRouter.delete('/:id', validate(revokeDeviceSchema), devicesController.revokeDevice);

// Permissions Sub-Router
const permissionsRouter = Router();
permissionsRouter.use(requireAuth);
permissionsRouter.use(requireRole(['ADMIN']));

permissionsRouter.post('/', validate(createPermissionSchema), permissionsController.createPermission);
permissionsRouter.get('/', validate(listPermissionsSchema), permissionsController.listPermissions);
permissionsRouter.post('/assign', validate(assignPermissionSchema), permissionsController.assignPermission);
permissionsRouter.get('/:id', validate(permissionIdParamSchema), permissionsController.getPermission);
permissionsRouter.put('/:id', validate(updatePermissionSchema), permissionsController.updatePermission);
permissionsRouter.delete('/:id', validate(permissionIdParamSchema), permissionsController.deletePermission);

// Roles Sub-Router
const rolesRouter = Router();
rolesRouter.use(requireAuth);
rolesRouter.use(requireRole(['ADMIN']));

rolesRouter.post('/', validate(createRoleSchema), rolesController.createRole);
rolesRouter.get('/', validate(listRolesSchema), rolesController.listRoles);
rolesRouter.post('/assign', validate(assignRoleSchema), rolesController.assignRole);
rolesRouter.get('/:id', validate(roleIdParamSchema), rolesController.getRole);
rolesRouter.put('/:id', validate(updateRoleSchema), rolesController.updateRole);
rolesRouter.delete('/:id', validate(roleIdParamSchema), rolesController.deleteRole);

// Sessions Sub-Router
const sessionsRouter = Router();
sessionsRouter.use(requireAuth);

sessionsRouter.post('/', validate(createSessionSchema), sessionsController.createSession);
sessionsRouter.get('/', validate(listSessionsSchema), sessionsController.listSessions);
sessionsRouter.post('/revoke-all', sessionsController.revokeAllSessions);
sessionsRouter.delete('/:id', validate(revokeSessionSchema), sessionsController.revokeSession);

// Identity Activity Sub-Router
const identityActivityRouter = Router();
identityActivityRouter.use(requireAuth);
identityActivityRouter.use(requireSession);

identityActivityRouter.get('/', validate(listActivitiesSchema), identityActivityController.listActivities);

// Mount Sub-routers
mainRouter.use('/devices', devicesRouter);
mainRouter.use('/permissions', permissionsRouter);
mainRouter.use('/roles', rolesRouter);
mainRouter.use('/sessions', sessionsRouter);
mainRouter.use('/identity-activity', identityActivityRouter);

export default mainRouter;
