import { Router } from 'express';
import profileRoutes from './profileRoutes.js';
import eventRoutes from './eventRoutes.js';
import identityRoutes from './identityRoutes.js';
import requestRoutes from './requestRoutes.js';
import notificationRoutes from './notificationRoutes.js';

const router = Router();

router.use('/profile', profileRoutes);
router.use('/events', eventRoutes);
router.use('/identity', identityRoutes);
router.use('/requests', requestRoutes);
router.use('/notifications', notificationRoutes);

export default router;
