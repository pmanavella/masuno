import { Router } from 'express';
import { requireAuth, requireConfirmedEmail } from '../middleware/authMiddleware.js';
import { listNotifications, markNotificationsRead } from '../controllers/notificationController.js';

const router = Router();

router.get('/', requireAuth, requireConfirmedEmail, listNotifications);
router.post('/read', requireAuth, requireConfirmedEmail, markNotificationsRead);

export default router;
