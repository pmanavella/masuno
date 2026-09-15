-- Imágenes placeholder (picsum.photos) por categoría, 2 por cada una, y backfill
-- de los eventos de ejemplo ya cargados. Reemplazar por fotos reales antes de producción.

insert into public.category_default_images (category, image_url) values
  ('Deportes', 'https://picsum.photos/seed/deportes-a/600/400'),
  ('Deportes', 'https://picsum.photos/seed/deportes-b/600/400'),
  ('Social', 'https://picsum.photos/seed/social-a/600/400'),
  ('Social', 'https://picsum.photos/seed/social-b/600/400'),
  ('Aire libre', 'https://picsum.photos/seed/airelibre-a/600/400'),
  ('Aire libre', 'https://picsum.photos/seed/airelibre-b/600/400'),
  ('Cultura', 'https://picsum.photos/seed/cultura-a/600/400'),
  ('Cultura', 'https://picsum.photos/seed/cultura-b/600/400'),
  ('Networking', 'https://picsum.photos/seed/networking-a/600/400'),
  ('Networking', 'https://picsum.photos/seed/networking-b/600/400');

update public.events set image_url = 'https://picsum.photos/seed/deportes-a/600/400' where title = 'Fútbol 5 mixto · nivel medio';
update public.events set image_url = 'https://picsum.photos/seed/social-a/600/400' where title = 'Cena de recién llegados a la ciudad';
update public.events set image_url = 'https://picsum.photos/seed/airelibre-a/600/400' where title = 'Trekking al Cerro Pan de Azúcar';
update public.events set image_url = 'https://picsum.photos/seed/deportes-b/600/400' where title = 'Vóley playa · falta 1 pareja';
update public.events set image_url = 'https://picsum.photos/seed/cultura-a/600/400' where title = 'Noche de trivia en bar';
update public.events set image_url = 'https://picsum.photos/seed/networking-a/600/400' where title = 'Café + networking freelancers';
