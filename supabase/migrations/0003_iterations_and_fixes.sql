-- ============================================================================
-- Миграция 0003: Секции ингредиентов, предложенные рецепты из приложения
--                и пакетная RPC-функция для мгновенного списка покупок.
-- ============================================================================

-- ============================================================================
-- 1. Группировка ингредиентов по секциям («Для теста», «Для начинки» и т.д.)
-- ============================================================================

alter table public.ingredients
  add column if not exists section_name text default null;

create index if not exists idx_ingredients_recipe_section_order
  on public.ingredients (recipe_id, order_index);

-- ============================================================================
-- 2. Таблица заявок / предложенных рецептов от членов семьи
-- ============================================================================

create table if not exists public.recipe_suggestions (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  mode text not null default 'quick' check (mode in ('quick', 'full')),
  title text not null check (char_length(trim(title)) > 0),
  notes text,
  source_url text,
  author_name text,
  category text not null default 'Основные блюда',
  cover_url text,
  prep_time_min integer not null default 0 check (prep_time_min >= 0),
  cook_time_min integer not null default 0 check (cook_time_min >= 0),
  base_servings integer not null default 4 check (base_servings > 0),
  total_weight_g integer check (total_weight_g is null or total_weight_g > 0),
  calories numeric(8, 2) check (calories is null or calories >= 0),
  proteins numeric(8, 2) check (proteins is null or proteins >= 0),
  fats numeric(8, 2) check (fats is null or fats >= 0),
  carbs numeric(8, 2) check (carbs is null or carbs >= 0),
  ingredients jsonb not null default '[]'::jsonb,
  content_blocks jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  published_recipe_id uuid references public.recipes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recipe_suggestions_status_created
  on public.recipe_suggestions (status, created_at desc);

drop trigger if exists trg_recipe_suggestions_updated_at on public.recipe_suggestions;
create trigger trg_recipe_suggestions_updated_at
  before update on public.recipe_suggestions
  for each row
  execute function public.set_updated_at();

alter table public.recipe_suggestions enable row level security;

grant insert on table public.recipe_suggestions to anon;
grant select, insert, update, delete on table public.recipe_suggestions to authenticated;

drop policy if exists "Anyone can suggest recipe" on public.recipe_suggestions;
create policy "Anyone can suggest recipe"
  on public.recipe_suggestions for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Admins read recipe suggestions" on public.recipe_suggestions;
create policy "Admins read recipe suggestions"
  on public.recipe_suggestions for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists "Admins update recipe suggestions" on public.recipe_suggestions;
create policy "Admins update recipe suggestions"
  on public.recipe_suggestions for update
  to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

drop policy if exists "Admins delete recipe suggestions" on public.recipe_suggestions;
create policy "Admins delete recipe suggestions"
  on public.recipe_suggestions for delete
  to authenticated
  using ((select auth.uid()) is not null);

-- Включаем Realtime для мгновенного отображения новых заявок в админке
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'recipe_suggestions'
  ) then
    alter publication supabase_realtime add table public.recipe_suggestions;
  end if;
end $$;

-- Разрешаем загрузку фото для предложенных рецептов с мобильного приложения (строго в папку suggestions/)
drop policy if exists "Anon upload suggested recipe media" on storage.objects;
create policy "Anon upload suggested recipe media"
  on storage.objects for insert
  to anon
  with check (
    bucket_id = 'recipe-media'
    and name like 'suggestions/%'
  );

-- ============================================================================
-- 3. Пакетная RPC-функция для мгновенного добавления и суммирования
--    ингредиентов в список покупок одним сетевым запросом.
-- ============================================================================

create or replace function public.add_or_merge_shopping_items_batch(items jsonb)
returns setof public.shopping_list
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item jsonb;
  v_name text;
  v_amount numeric;
  v_unit text;
  v_recipe_title text;
  v_existing public.shopping_list;
  v_row public.shopping_list;
  v_affected_ids uuid[] := '{}'::uuid[];
begin
  if items is null or jsonb_typeof(items) <> 'array' then
    return;
  end if;

  for v_item in select * from jsonb_array_elements(items)
  loop
    v_name := trim(coalesce(v_item->>'product_name', ''));
    if char_length(v_name) = 0 then
      continue;
    end if;

    v_unit := trim(coalesce(nullif(v_item->>'unit', ''), 'шт'));
    v_amount := coalesce((v_item->>'amount')::numeric, 1);
    v_recipe_title := nullif(trim(coalesce(v_item->>'recipe_title', '')), '');

    select *
    into v_existing
    from public.shopping_list
    where lower(trim(product_name)) = lower(v_name)
      and lower(trim(unit)) = lower(v_unit)
      and is_checked = false
    order by created_at asc
    limit 1;

    if found then
      update public.shopping_list
      set
        amount = coalesce(amount, 0) + coalesce(v_amount, 0),
        recipe_title = case
          when recipe_title is null or recipe_title = '' then v_recipe_title
          when v_recipe_title is null or v_recipe_title = '' then recipe_title
          when position(v_recipe_title in recipe_title) > 0 then recipe_title
          else recipe_title || ', ' || v_recipe_title
        end
      where id = v_existing.id
      returning * into v_row;
    else
      insert into public.shopping_list (product_name, amount, unit, is_checked, recipe_title)
      values (v_name, coalesce(v_amount, 1), v_unit, false, v_recipe_title)
      returning * into v_row;
    end if;

    if not (v_row.id = any(v_affected_ids)) then
      v_affected_ids := array_append(v_affected_ids, v_row.id);
    end if;
  end loop;

  return query
  select *
  from public.shopping_list
  where id = any(v_affected_ids)
  order by created_at desc;
end;
$$;

grant execute on function public.add_or_merge_shopping_items_batch(jsonb) to anon, authenticated;
