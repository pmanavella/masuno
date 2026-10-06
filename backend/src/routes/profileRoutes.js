import { Router } from 'express';
import { requireAuth, requireConfirmedEmail } from '../middleware/authMiddleware.js';
import { getMyProfile, updateMyProfile } from '../controllers/profileController.js';

const router = Router();

router.get('/', requireAuth, getMyProfile);
router.put('/', requireAuth, requireConfirmedEmail, updateMyProfile);

export default router;
