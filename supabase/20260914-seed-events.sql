-- Eventos de ejemplo para que el feed tenga contenido (todavía no hay creación real de eventos).

insert into public.events
  (title, description, category, city, starts_at, spots_total, spots_taken, age_min, age_max, gender, organizer_name, organizer_initials, organizer_rating, organizer_review_count)
values
  ('Fútbol 5 mixto · nivel medio', 'Cancha techada, se arman equipos mixtos.', 'Deportes', 'Córdoba Capital', now() + interval '2 days' + interval '19 hours', 10, 8, 20, 30, 'Indistinto', 'Mati R.', 'MR', 4.8, 32),
  ('Cena de recién llegados a la ciudad', 'Para conocer gente si te mudaste hace poco.', 'Social', 'Córdoba Capital', now() + interval '3 days' + interval '21 hours', 12, 7, 22, 35, 'Indistinto', 'Fer G.', 'FG', 4.5, 10),
  ('Trekking al Cerro Pan de Azúcar', 'Nivel accesible, salida temprano con guía.', 'Aire libre', 'Córdoba Capital', now() + interval '4 days' + interval '8 hours', 10, 7, 18, 99, 'Indistinto', 'Male D.', 'MD', 5.0, 6),
  ('Vóley playa · falta 1 pareja', 'Buen nivel de juego, cancha de arena.', 'Deportes', 'Córdoba Capital', now() + interval '2 days' + interval '18 hours', 4, 3, 20, 30, 'Femenino', 'Euge S.', 'ES', 4.9, 14),
  ('Noche de trivia en bar', 'Equipos de a 4 al llegar, buen ambiente.', 'Cultura', 'Córdoba Capital', now() + interval '1 day' + interval '20 hours', 20, 14, 18, 99, 'Indistinto', 'Lu M.', 'LM', 4.2, 9),
  ('Café + networking freelancers', 'Mesa reservada, ambiente relajado.', 'Networking', 'Córdoba Capital', now() + interval '5 days' + interval '10 hours', 8, 5, 25, 45, 'Indistinto', 'Db K.', 'DK', 4.6, 11);
