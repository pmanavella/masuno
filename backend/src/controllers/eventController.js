import { EventModel } from '../models/EventModel.js';

export async function listEvents(req, res, next) {
  try {
    const { city, categories, date, ageMin, ageMax, gender } = req.query;
    const events = await EventModel.list({
      city,
      categories: categories ? categories.split(',').filter(Boolean) : [],
      date,
      ageMin: ageMin ? Number(ageMin) : null,
      ageMax: ageMax ? Number(ageMax) : null,
      gender,
    });
    res.json(events);
  } catch (err) {
    next(err);
  }
}

export async function listCities(req, res, next) {
  try {
    const cities = await EventModel.listCities();
    res.json(cities);
  } catch (err) {
    next(err);
  }
}
