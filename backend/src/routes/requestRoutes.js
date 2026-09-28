import { Router } from 'express';
import { requireAuth, requireVerified } from '../middleware/authMiddleware.js';
import { requireUuidParam } from '../middleware/validateParams.js';
import { listMyRequests, respondToRequest, cancelRequest } from '../controllers/requestController.js';

const router = Router();

router.get('/mine', requireAuth, requireVerified, listMyRequests);
router.post('/:id/respond', requireUuidParam, requireAuth, requireVerified, respondToRequest);
router.post('/:id/cancel', requireUuidParam, requireAuth, requireVerified, cancelRequest);

export default router;
