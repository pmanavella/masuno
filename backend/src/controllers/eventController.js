import { EventModel } from '../models/EventModel.js';
import { RequestModel } from '../models/RequestModel.js';
import { eventError, reasonMessage, validateNewEvent } from '../services/eventService.js';

function toInt(value) {
  const n = Number(value);
  return value !== undefined && value !== '' && Number.isInteger(n) ? n : null;
}

export async function listEvents(req, res, next) {
  try {
    const { city, categories, date, ageMin, ageMax, gender } = req.query;
    const events = await EventModel.list(
      {
        city,
        categories: categories ? categories.split(',').filter(Boolean) : [],
        date,
        ageMin: toInt(ageMin),
        ageMax: toInt(ageMax),
        gender,
      },
      req.accessToken
    );
    res.json(events);
  } catch (err) {
    next(err);
  }
}

export async function listCities(req, res, next) {
  try {
    const cities = await EventModel.listCities(req.accessToken);
    res.json(cities);
  } catch (err) {
    next(err);
  }
}

// Detalle público. Con sesión suma lo que ve ese usuario: si puede unirse (y por qué no),
// su solicitud, y si es el organizador, las solicitudes recibidas.
export async function getEvent(req, res, next) {
  try {
    const event = await EventModel.getById(req.params.id, req.accessToken);
    if (!event) throw eventError('not_found');

    if (!req.user) return res.json({ event, viewer: null });

    const isOrganizer = event.organizer_id === req.user.id;
    const [canJoin, myRequest, requests] = await Promise.all([
      RequestModel.canJoin(event.id, req.accessToken),
      isOrganizer ? null : RequestModel.getMine(event.id, req.user.id, req.accessToken),
      isOrganizer ? RequestModel.listForEvent(event.id, req.accessToken) : null,
    ]);

    res.json({
      event,
      viewer: { isOrganizer, canJoin, canJoinMessage: reasonMessage(canJoin), myRequest, requests },
    });
  } catch (err) {
    next(err);
  }
}

export async function createEvent(req, res, next) {
  try {
    const fields = validateNewEvent(req.body);
    const event = await EventModel.create(fields, req.user.id, req.accessToken);
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
}

export async function listOrganizedEvents(req, res, next) {
  try {
    res.json(await EventModel.listOrganized(req.user.id, req.accessToken));
  } catch (err) {
    next(err);
  }
}

export async function requestToJoin(req, res, next) {
  try {
    const requestId = await RequestModel.requestToJoin(req.params.id, req.accessToken);
    res.status(201).json({ id: requestId, status: 'pending' });
  } catch (err) {
    next(err);
  }
}
