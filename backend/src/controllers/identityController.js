import { IdentityModel } from '../models/IdentityModel.js';
import { verifyIdentity } from '../services/identityService.js';

const maxAttempts = Number(process.env.IDENTITY_MAX_ATTEMPTS) || 5;
const attemptWindowMinutes = Number(process.env.IDENTITY_ATTEMPT_WINDOW_MINUTES) || 1440;

// Verificación de identidad contra ARCA (etapa futura). Solo se usa con ARCA_ENABLED=true.
export function createIdentityController({ arca }) {
  return {
    async getMyIdentity(req, res, next) {
      try {
        const [identityVerifiedByArca, identity] = await Promise.all([
          IdentityModel.isVerified(req.accessToken),
          IdentityModel.getMine(req.accessToken),
        ]);
        res.json({ identityVerifiedByArca, identity: identityVerifiedByArca ? identity : null });
      } catch (err) {
        next(err);
      }
    },

    async verifyMyIdentity(req, res, next) {
      try {
        const identity = await verifyIdentity(
          { userId: req.user.id, accessToken: req.accessToken, body: req.body },
          { arca, model: IdentityModel, maxAttempts, attemptWindowMinutes }
        );
        res.status(201).json({ identityVerifiedByArca: true, identity });
      } catch (err) {
        next(err);
      }
    },
  };
}
