-- ============================================================================
-- Семейная кулинарная книга — Начальная миграция Supabase (PostgreSQL + RLS + Storage)
-- ============================================================================

-- 0. Расширения
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. Таблицы
-- ============================================================================

-- 1.1. Рецепты
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  description text,
  category text not null default 'Основные блюда',
  cover_url text,
  video_preview_url text,
  prep_time_min integer not null default 0 check (prep_time_min >= 0),
  cook_time_min integer not null default 0 check (cook_time_min >= 0),
  base_servings integer not null default 2 check (base_servings > 0),
  total_weight_g integer check (total_weight_g is null or total_weight_g > 0),
  calories numeric(8, 2) check (calories is null or calories >= 0),
  proteins numeric(8, 2) check (proteins is null or proteins >= 0),
  fats numeric(8, 2) check (fats is null or fats >= 0),
  carbs numeric(8, 2) check (carbs is null or carbs >= 0),
  content_blocks jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1.2. Ингредиенты
create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  amount numeric(10, 3) check (amount is null or amount >= 0),
  unit text not null default 'г',
  is_scalable boolean not null default true,
  order_index integer not null default 0
);

-- 1.3. Семейный список покупок
create table if not exists public.shopping_list (
  id uuid primary key default gen_random_uuid(),
  product_name text not null check (char_length(trim(product_name)) > 0),
  amount numeric(10, 3) not null default 1 check (amount >= 0),
  unit text not null default 'шт',
  is_checked boolean not null default false,
  recipe_title text,
  created_at timestamptz not null default now()
);

-- 1.4. Личные заметки к рецептам
create table if not exists public.user_notes (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  note_text text not null check (char_length(trim(note_text)) > 0),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 2. Индексы и триггеры
-- ============================================================================

create index if not exists idx_recipes_category on public.recipes (category);
create index if not exists idx_recipes_created_at on public.recipes (created_at desc);
create index if not exists idx_ingredients_recipe_order on public.ingredients (recipe_id, order_index);
create index if not exists idx_ingredients_name on public.ingredients using gin (to_tsvector('russian', name));
create index if not exists idx_shopping_list_checked on public.shopping_list (is_checked, created_at desc);
create index if not exists idx_shopping_list_product_unit on public.shopping_list (lower(trim(product_name)), lower(trim(unit)));
create index if not exists idx_user_notes_recipe_created on public.user_notes (recipe_id, created_at desc);

-- Автообновление updated_at для recipes
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_recipes_updated_at on public.recipes;
create trigger trg_recipes_updated_at
  before update on public.recipes
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- 3. RPC-функция для умного добавления и суммирования в списке покупок
--    Если продукт с тем же названием и единицей измерения уже есть (не куплен),
--    количество суммируется атомарно на стороне БД.
-- ============================================================================

create or replace function public.add_or_merge_shopping_item(
  p_product_name text,
  p_amount numeric,
  p_unit text,
  p_recipe_title text default null
)
returns public.shopping_list
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing public.shopping_list;
  v_result public.shopping_list;
begin
  select *
  into v_existing
  from public.shopping_list
  where lower(trim(product_name)) = lower(trim(p_product_name))
    and lower(trim(unit)) = lower(trim(p_unit))
    and is_checked = false
  order by created_at asc
  limit 1;

  if found then
    update public.shopping_list
    set
      amount = coalesce(amount, 0) + coalesce(p_amount, 0),
      recipe_title = case
        when recipe_title is null or recipe_title = '' then p_recipe_title
        when p_recipe_title is null or p_recipe_title = '' then recipe_title
        when position(p_recipe_title in recipe_title) > 0 then recipe_title
        else recipe_title || ', ' || p_recipe_title
      end
    where id = v_existing.id
    returning * into v_result;
  else
    insert into public.shopping_list (product_name, amount, unit, is_checked, recipe_title)
    values (trim(p_product_name), coalesce(p_amount, 1), trim(p_unit), false, p_recipe_title)
    returning * into v_result;
  end if;

  return v_result;
end;
$$;

grant execute on function public.add_or_merge_shopping_item(text, numeric, text, text) to authenticated;

-- ============================================================================
-- 4. Row Level Security (RLS)
--    Доступ к закрытой семейной книге имеют только авторизованные пользователи.
-- ============================================================================

alter table public.recipes enable row level security;
alter table public.ingredients enable row level security;
alter table public.shopping_list enable row level security;
alter table public.user_notes enable row level security;

-- Recipes
drop policy if exists "Family read recipes" on public.recipes;
create policy "Family read recipes"
  on public.recipes for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists "Family insert recipes" on public.recipes;
create policy "Family insert recipes"
  on public.recipes for insert
  to authenticated
  with check ((select auth.uid()) is not null);

drop policy if exists "Family update recipes" on public.recipes;
create policy "Family update recipes"
  on public.recipes for update
  to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

drop policy if exists "Family delete recipes" on public.recipes;
create policy "Family delete recipes"
  on public.recipes for delete
  to authenticated
  using ((select auth.uid()) is not null);

-- Ingredients
drop policy if exists "Family read ingredients" on public.ingredients;
create policy "Family read ingredients"
  on public.ingredients for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists "Family insert ingredients" on public.ingredients;
create policy "Family insert ingredients"
  on public.ingredients for insert
  to authenticated
  with check ((select auth.uid()) is not null);

drop policy if exists "Family update ingredients" on public.ingredients;
create policy "Family update ingredients"
  on public.ingredients for update
  to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

drop policy if exists "Family delete ingredients" on public.ingredients;
create policy "Family delete ingredients"
  on public.ingredients for delete
  to authenticated
  using ((select auth.uid()) is not null);

-- Shopping List
drop policy if exists "Family manage shopping list" on public.shopping_list;
create policy "Family manage shopping list"
  on public.shopping_list for all
  to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

-- User Notes
drop policy if exists "Family manage user notes" on public.user_notes;
create policy "Family manage user notes"
  on public.user_notes for all
  to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

-- ============================================================================
-- 5. Supabase Realtime
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shopping_list'
  ) then
    alter publication supabase_realtime add table public.shopping_list;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'recipes'
  ) then
    alter publication supabase_realtime add table public.recipes;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_notes'
  ) then
    alter publication supabase_realtime add table public.user_notes;
  end if;
end $$;

-- ============================================================================
-- 6. Supabase Storage Bucket (`recipe-media`)
--    Публичное чтение по прямой ссылке (для <img>/<video> в TipTap и офлайн-кэша),
--    загрузка/изменение/удаление строго для авторизованных пользователей.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-media',
  'recipe-media',
  true,
  52428800, -- 50 MB (достаточно для фото и коротких сжатых видео)
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read recipe media" on storage.objects;
create policy "Public read recipe media"
  on storage.objects for select
  to public
  using (bucket_id = 'recipe-media');

drop policy if exists "Authenticated upload recipe media" on storage.objects;
create policy "Authenticated upload recipe media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'recipe-media'
    and (select auth.uid()) is not null
  );

drop policy if exists "Authenticated update recipe media" on storage.objects;
create policy "Authenticated update recipe media"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'recipe-media'
    and (select auth.uid()) is not null
  )
  with check (
    bucket_id = 'recipe-media'
    and (select auth.uid()) is not null
  );

drop policy if exists "Authenticated delete recipe media" on storage.objects;
create policy "Authenticated delete recipe media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'recipe-media'
    and (select auth.uid()) is not null
  );
