import { Router } from 'express';
import { requireAuth, requireConfirmedEmail } from '../middleware/authMiddleware.js';
import { requireUuidParam } from '../middleware/validateParams.js';
import { listMyRequests, respondToRequest, cancelRequest } from '../controllers/requestController.js';

const router = Router();

router.get('/mine', requireAuth, requireConfirmedEmail, listMyRequests);
router.post('/:id/respond', requireUuidParam, requireAuth, requireConfirmedEmail, respondToRequest);
router.post('/:id/cancel', requireUuidParam, requireAuth, requireConfirmedEmail, cancelRequest);

export default router;
