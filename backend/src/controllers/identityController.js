import { IdentityModel } from '../models/IdentityModel.js';
import { createArcaClient } from '../services/arca/index.js';
import { verifyIdentity } from '../services/identityService.js';

// Se crea al arrancar: si ARCA_MODE falta o es mock en producción, el backend no levanta.
const arca = createArcaClient({ ticketStore: IdentityModel.arcaTicketStore });

const maxAttempts = Number(process.env.IDENTITY_MAX_ATTEMPTS) || 5;
const attemptWindowMinutes = Number(process.env.IDENTITY_ATTEMPT_WINDOW_MINUTES) || 1440;

export async function getMyIdentity(req, res, next) {
  try {
    const identity = await IdentityModel.getMine(req.accessToken);
    res.json({ verified: identity !== null, identity });
  } catch (err) {
    next(err);
  }
}

export async function verifyMyIdentity(req, res, next) {
  try {
    const identity = await verifyIdentity(
      { userId: req.user.id, accessToken: req.accessToken, body: req.body },
      { arca, model: IdentityModel, maxAttempts, attemptWindowMinutes }
    );
    res.status(201).json({ verified: true, identity });
  } catch (err) {
    next(err);
  }
}
