import { Router } from 'express';
import { isArcaEnabled } from '../config/arca.js';
import authRoutes from './authRoutes.js';
import profileRoutes from './profileRoutes.js';
import eventRoutes from './eventRoutes.js';
import { createIdentityRoutes } from './identityRoutes.js';
import requestRoutes from './requestRoutes.js';
import notificationRoutes from './notificationRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/events', eventRoutes);
router.use('/requests', requestRoutes);
router.use('/notifications', notificationRoutes);

// Verificación de identidad contra ARCA: fuera del MVP. Con ARCA_ENABLED=false no se monta
// (404) y no se crea ningún cliente de ARCA.
if (isArcaEnabled()) {
  router.use('/identity', createIdentityRoutes());
}

export default router;
