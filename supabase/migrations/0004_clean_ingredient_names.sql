-- ============================================================================
-- Миграция 0004: Очистка названий ингредиентов и списка покупок от скобок (...)
--                + автоматическое извлечение секции назначения
--                + нормализация в RPC-функциях списка покупок.
-- ============================================================================

-- 1. Переносим типовые назначения из скобок в section_name там, где секция ещё не заполнена
update public.ingredients
set section_name = case
  when name ~* '\(\s*(?:для\s+теста|в\s+тесто|на\s+тесто)\s*\)' then 'Для теста'
  when name ~* '\(\s*(?:для\s+начинки|в\s+начинку|на\s+начинку)\s*\)' then 'Для начинки'
  when name ~* '\(\s*(?:для\s+соуса|в\s+соус|на\s+соус)\s*\)' then 'Для соуса'
  when name ~* '\(\s*(?:для\s+подачи|к\s+подаче|на\s+подачу|при\s+подаче)\s*\)' then 'Для подачи'
  when name ~* '\(\s*(?:для\s+крема|в\s+крем|на\s+крем)\s*\)' then 'Для крема'
  when name ~* '\(\s*(?:для\s+маринада|в\s+маринад|для\s+маринования)\s*\)' then 'Для маринада'
  else section_name
end
where (section_name is null or trim(section_name) = '')
  and name ~* '\(\s*(?:для|в|на|к|при)\s+[^)]+\)';

-- 2. Очищаем существующие названия в таблице ingredients от скобок (...) и лишних пробелов
update public.ingredients
set name = coalesce(
  nullif(trim(regexp_replace(regexp_replace(name, '\s*\([^)]*\)\s*', ' ', 'g'), '\s{2,}', ' ', 'g')), ''),
  trim(name)
)
where name ~ '\([^)]*\)';

-- 3. Очищаем существующие названия в таблице shopping_list от скобок (...) и лишних пробелов
update public.shopping_list
set product_name = coalesce(
  nullif(trim(regexp_replace(regexp_replace(product_name, '\s*\([^)]*\)\s*', ' ', 'g'), '\s{2,}', ' ', 'g')), ''),
  trim(product_name)
)
where product_name ~ '\([^)]*\)';

-- 4. Объединяем дубликаты некупленных позиций в shopping_list, возникшие после очистки скобок
do $$
declare
  v_grp record;
  v_total_amount numeric;
  v_merged_recipes text;
begin
  for v_grp in
    select
      lower(trim(product_name)) as norm_name,
      lower(trim(unit)) as norm_unit,
      (array_agg(id order by created_at asc))[1] as keep_id,
      count(*) as cnt
    from public.shopping_list
    where is_checked = false
    group by lower(trim(product_name)), lower(trim(unit))
    having count(*) > 1
  loop
    select
      coalesce(sum(amount), 0),
      nullif(string_agg(distinct nullif(trim(recipe_title), ''), ', '), '')
    into v_total_amount, v_merged_recipes
    from public.shopping_list
    where is_checked = false
      and lower(trim(product_name)) = v_grp.norm_name
      and lower(trim(unit)) = v_grp.norm_unit;

    update public.shopping_list
    set
      amount = v_total_amount,
      recipe_title = coalesce(v_merged_recipes, recipe_title)
    where id = v_grp.keep_id;

    delete from public.shopping_list
    where is_checked = false
      and lower(trim(product_name)) = v_grp.norm_name
      and lower(trim(unit)) = v_grp.norm_unit
      and id <> v_grp.keep_id;
  end loop;
end $$;

-- 5. Обновляем одиночную RPC-функцию добавления с автоматической очисткой скобок
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
  v_clean_name text;
  v_clean_unit text;
  v_existing public.shopping_list;
  v_result public.shopping_list;
begin
  v_clean_name := coalesce(
    nullif(trim(regexp_replace(regexp_replace(coalesce(p_product_name, ''), '\s*\([^)]*\)\s*', ' ', 'g'), '\s{2,}', ' ', 'g')), ''),
    trim(coalesce(p_product_name, ''))
  );
  v_clean_unit := trim(coalesce(nullif(p_unit, ''), 'шт'));

  select *
  into v_existing
  from public.shopping_list
  where lower(trim(product_name)) = lower(v_clean_name)
    and lower(trim(unit)) = lower(v_clean_unit)
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
    values (v_clean_name, coalesce(p_amount, 1), v_clean_unit, false, p_recipe_title)
    returning * into v_result;
  end if;

  return v_result;
end;
$$;

-- 6. Обновляем пакетную RPC-функцию с автоматической очисткой скобок перед суммированием
create or replace function public.add_or_merge_shopping_items_batch(items jsonb)
returns setof public.shopping_list
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item jsonb;
  v_raw_name text;
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
    v_raw_name := trim(coalesce(v_item->>'product_name', ''));
    v_name := coalesce(
      nullif(trim(regexp_replace(regexp_replace(v_raw_name, '\s*\([^)]*\)\s*', ' ', 'g'), '\s{2,}', ' ', 'g')), ''),
      v_raw_name
    );

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
