-- Amplía la lista de categorías permitidas (más específicas, menos genéricas) en
-- events y category_default_images, agrega placeholders de imagen para las nuevas,
-- y recategoriza 2 eventos de ejemplo que ahora tienen una categoría más precisa.

alter table public.events drop constraint events_category_check;
alter table public.events add constraint events_category_check
  check (category in (
    'Deportes', 'Social', 'Aire libre', 'Cultura', 'Networking',
    'Música', 'Gastronomía', 'Vida nocturna', 'Juegos', 'Bienestar'
  ));

alter table public.category_default_images drop constraint category_default_images_category_check;
alter table public.category_default_images add constraint category_default_images_category_check
  check (category in (
    'Deportes', 'Social', 'Aire libre', 'Cultura', 'Networking',
    'Música', 'Gastronomía', 'Vida nocturna', 'Juegos', 'Bienestar'
  ));

insert into public.category_default_images (category, image_url) values
  ('Música', 'https://picsum.photos/seed/musica-a/600/400'),
  ('Música', 'https://picsum.photos/seed/musica-b/600/400'),
  ('Gastronomía', 'https://picsum.photos/seed/gastronomia-a/600/400'),
  ('Gastronomía', 'https://picsum.photos/seed/gastronomia-b/600/400'),
  ('Vida nocturna', 'https://picsum.photos/seed/vidanocturna-a/600/400'),
  ('Vida nocturna', 'https://picsum.photos/seed/vidanocturna-b/600/400'),
  ('Juegos', 'https://picsum.photos/seed/juegos-a/600/400'),
  ('Juegos', 'https://picsum.photos/seed/juegos-b/600/400'),
  ('Bienestar', 'https://picsum.photos/seed/bienestar-a/600/400'),
  ('Bienestar', 'https://picsum.photos/seed/bienestar-b/600/400');

update public.events set category = 'Gastronomía' where title = 'Cena de recién llegados a la ciudad';
update public.events set category = 'Juegos' where title = 'Noche de trivia en bar';
