import { Router } from 'express';
import { requireAuth, requireVerified } from '../middleware/authMiddleware.js';
import { listNotifications, markNotificationsRead } from '../controllers/notificationController.js';

const router = Router();

router.get('/', requireAuth, requireVerified, listNotifications);
router.post('/read', requireAuth, requireVerified, markNotificationsRead);

export default router;
