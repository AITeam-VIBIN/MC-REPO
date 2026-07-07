import { Router } from 'express';
import { CheckoutController } from '../controllers/checkout.controller.js';
import { requireAuth, requireSession, requirePermission } from '../middleware/index.js';
import {
  createCheckoutSchema,
  updateCheckoutSchema,
  listCheckoutsSchema,
  idParamSchema,
  createMovementSchema,
  updateLocationSchema
} from '../validations/checkout.validation.js';

const router = Router();
const checkoutController = new CheckoutController();

// Validation Middleware Helper
const validate = (schema) => (req, res, next) => {
  try {
    if (schema === idParamSchema) {
      schema.parse(req.params);
    } else {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};

// All checkout endpoints require authentication and an active session
router.use(requireAuth);
router.use(requireSession);

/**
 * @openapi
 * /checkouts:
 *   post:
 *     summary: Submit checkout request
 *     description: Submits a new document checkout request for approval.
 *     security:
 *       - BearerAuth: []
 */
router.post('/', requirePermission('CHECKOUT_CREATE'), validate(createCheckoutSchema), checkoutController.createCheckout);

/**
 * @openapi
 * /checkouts:
 *   get:
 *     summary: List checkouts
 *     description: Retrieves list of checkouts matching filters.
 *     security:
 *       - BearerAuth: []
 */
router.get('/', requirePermission('CHECKOUT_VIEW'), validate(listCheckoutsSchema), checkoutController.listCheckouts);

/**
 * @openapi
 * /checkouts/my:
 *   get:
 *     summary: List my checkouts
 *     description: Retrieves the current user's checkouts list.
 *     security:
 *       - BearerAuth: []
 */
router.get('/my', requirePermission('CHECKOUT_VIEW'), validate(listCheckoutsSchema), checkoutController.listMyCheckouts);

/**
 * @openapi
 * /checkouts/pending:
 *   get:
 *     summary: List pending approvals
 *     description: Retrieves list of checkouts awaiting administrator approval.
 *     security:
 *       - BearerAuth: []
 */
router.get('/pending', requirePermission('CHECKOUT_MANAGE'), validate(listCheckoutsSchema), checkoutController.listPendingCheckouts);

/**
 * @openapi
 * /checkouts/active:
 *   get:
 *     summary: List active checkouts
 *     description: Retrieves list of checkouts currently checked out.
 *     security:
 *       - BearerAuth: []
 */
router.get('/active', requirePermission('CHECKOUT_MANAGE'), validate(listCheckoutsSchema), checkoutController.listActiveCheckouts);

/**
 * @openapi
 * /checkouts/overdue:
 *   get:
 *     summary: List overdue checkouts
 *     description: Retrieves list of overdue checked out checkouts.
 *     security:
 *       - BearerAuth: []
 */
router.get('/overdue', requirePermission('CHECKOUT_MANAGE'), validate(listCheckoutsSchema), checkoutController.listOverdueCheckouts);

/**
 * @openapi
 * /checkouts/{id}:
 *   get:
 *     summary: Fetch checkout details
 *     description: Retrieves full metadata details of a checkout.
 *     security:
 *       - BearerAuth: []
 */
router.get('/:id', requirePermission('CHECKOUT_VIEW'), validate(idParamSchema), checkoutController.getCheckoutDetails);

/**
 * @openapi
 * /checkouts/{id}:
 *   post:
 *     summary: Update checkout request
 *     description: Updates editable fields on a draft or pending checkout request.
 *     security:
 *       - BearerAuth: []
 */
router.patch('/:id', requirePermission('CHECKOUT_UPDATE'), validate(updateCheckoutSchema), checkoutController.updateCheckout);

/**
 * @openapi
 * /checkouts/{id}/cancel:
 *   patch:
 *     summary: Cancel checkout request
 *     description: Cancels a pending or draft checkout request.
 *     security:
 *       - BearerAuth: []
 */
router.patch('/:id/cancel', requirePermission('CHECKOUT_CANCEL'), validate(idParamSchema), checkoutController.cancelCheckout);

/**
 * @openapi
 * /checkouts/{id}:
 *   delete:
 *     summary: Soft delete checkout record
 *     description: Soft deletes a checkout record.
 *     security:
 *       - BearerAuth: []
 */
router.delete('/:id', requirePermission('CHECKOUT_MANAGE'), validate(idParamSchema), checkoutController.deleteCheckout);

/**
 * @openapi
 * /checkouts/{id}/movements:
 *   post:
 *     summary: Record physical movement event
 *     description: Creates a physical document movement tracking event.
 *     security:
 *       - BearerAuth: []
 */
router.post('/:id/movements', requirePermission('CHECKOUT_UPDATE'), validate(createMovementSchema), checkoutController.createMovement);

/**
 * @openapi
 * /checkouts/{id}/movements:
 *   get:
 *     summary: Get movement history
 *     description: Retrieves chronological logs of physical movements.
 *     security:
 *       - BearerAuth: []
 */
router.get('/:id/movements', requirePermission('CHECKOUT_VIEW'), validate(idParamSchema), checkoutController.getMovementHistory);

/**
 * @openapi
 * /checkouts/{id}/timeline:
 *   get:
 *     summary: Get chronological timeline
 *     description: Retreives unified timeline logs (request, approval, physical custody events).
 *     security:
 *       - BearerAuth: []
 */
router.get('/:id/timeline', requirePermission('CHECKOUT_VIEW'), validate(idParamSchema), checkoutController.getMovementTimeline);

/**
 * @openapi
 * /checkouts/{id}/location:
 *   patch:
 *     summary: Update location directly
 *     description: Updates current location parameter directly on checkout.
 *     security:
 *       - BearerAuth: []
 */
router.patch('/:id/location', requirePermission('CHECKOUT_UPDATE'), validate(updateLocationSchema), checkoutController.updateLocation);

export default router;
