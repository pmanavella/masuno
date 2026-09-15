-- Agrega la posibilidad de guardar una imagen por evento, y una tabla de imágenes
-- por defecto por categoría para cuando el organizador no suba una propia. La lógica
-- de "si no subís imagen, se asigna una al azar según la categoría" se implementa
-- en la iteración de creación de eventos (todavía no existe esa pantalla).

alter table public.events add column image_url text;

create table public.category_default_images (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('Deportes', 'Social', 'Aire libre', 'Cultura', 'Networking')),
  image_url text not null
);

alter table public.category_default_images enable row level security;

create policy "category_default_images_select_public" on public.category_default_images
  for select using (true);
