import { Router } from 'express';
import { requireAuth, requireVerified } from '../middleware/authMiddleware.js';
import { getMyProfile, updateMyProfile } from '../controllers/profileController.js';

const router = Router();

router.get('/', requireAuth, getMyProfile);
router.put('/', requireAuth, requireVerified, updateMyProfile);

export default router;
