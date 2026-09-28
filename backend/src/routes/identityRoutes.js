import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getMyIdentity, verifyMyIdentity } from '../controllers/identityController.js';

const router = Router();

router.get('/', requireAuth, getMyIdentity);
router.post('/verify', requireAuth, verifyMyIdentity);

export default router;
