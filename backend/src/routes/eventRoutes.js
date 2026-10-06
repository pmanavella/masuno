import { Router } from 'express';
import { optionalAuth, requireAuth, requireConfirmedEmail } from '../middleware/authMiddleware.js';
import { requireUuidParam } from '../middleware/validateParams.js';
import {
  listEvents,
  listCities,
  getEvent,
  createEvent,
  listOrganizedEvents,
  requestToJoin,
} from '../controllers/eventController.js';

const router = Router();

router.get('/cities', optionalAuth, listCities);
router.get('/organized', requireAuth, requireConfirmedEmail, listOrganizedEvents);
router.get('/', optionalAuth, listEvents);
router.post('/', requireAuth, requireConfirmedEmail, createEvent);
router.get('/:id', requireUuidParam, optionalAuth, getEvent);
router.post('/:id/requests', requireUuidParam, requireAuth, requireConfirmedEmail, requestToJoin);

export default router;
