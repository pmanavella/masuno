import { Router } from 'express';
import { listEvents, listCities } from '../controllers/eventController.js';

const router = Router();

router.get('/cities', listCities);
router.get('/', listEvents);

export default router;
