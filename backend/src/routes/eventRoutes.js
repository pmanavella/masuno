import { Router } from 'express';
import { optionalAuth, requireAuth, requireVerified } from '../middleware/authMiddleware.js';
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
router.get('/organized', requireAuth, requireVerified, listOrganizedEvents);
router.get('/', optionalAuth, listEvents);
router.post('/', requireAuth, requireVerified, createEvent);
router.get('/:id', requireUuidParam, optionalAuth, getEvent);
router.post('/:id/requests', requireUuidParam, requireAuth, requireVerified, requestToJoin);

export default router;
