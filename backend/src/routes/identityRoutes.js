import { Router } from 'express';
import { requireAuth, requireConfirmedEmail } from '../middleware/authMiddleware.js';
import { createIdentityController } from '../controllers/identityController.js';
import { IdentityModel } from '../models/IdentityModel.js';
import { createArcaClient } from '../services/arca/index.js';

// Verificación de identidad contra ARCA. Solo se monta con ARCA_ENABLED=true (routes/index.js).
// El cliente se crea al montar: si falta configuración, el backend no arranca.
export function createIdentityRoutes() {
  const arca = createArcaClient({ ticketStore: IdentityModel.arcaTicketStore });
  const { getMyIdentity, verifyMyIdentity } = createIdentityController({ arca });

  const router = Router();
  router.get('/', requireAuth, getMyIdentity);
  router.post('/verify', requireAuth, requireConfirmedEmail, verifyMyIdentity);
  return router;
}
