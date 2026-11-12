-- ============================================================================
-- Миграция 0002: Публичный доступ для семейного мобильного приложения (anon)
-- при сохранении защиты создания/изменения/удаления рецептов только для админов.
-- ============================================================================

-- 1. Права на таблицы в схеме public
grant usage on schema public to anon, authenticated;
grant select on table public.recipes, public.ingredients to anon, authenticated;
grant select, insert, update, delete on table public.shopping_list, public.user_notes to anon, authenticated;

-- 2. Таблица recipes:
--    Чтение (SELECT) — всем (anon и authenticated),
--    INSERT / UPDATE / DELETE — ТОЛЬКО авторизованным администраторам (authenticated).
drop policy if exists "Family read recipes" on public.recipes;
drop policy if exists "Public read recipes" on public.recipes;
create policy "Public read recipes"
  on public.recipes for select
  to anon, authenticated
  using (true);

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

-- 3. Таблица ingredients:
--    Чтение (SELECT) — всем (anon и authenticated),
--    INSERT / UPDATE / DELETE — ТОЛЬКО авторизованным администраторам (authenticated).
drop policy if exists "Family read ingredients" on public.ingredients;
drop policy if exists "Public read ingredients" on public.ingredients;
create policy "Public read ingredients"
  on public.ingredients for select
  to anon, authenticated
  using (true);

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

-- 4. Таблица shopping_list:
--    Чтение и запись (SELECT, INSERT, UPDATE, DELETE) — для anon и authenticated.
drop policy if exists "Family manage shopping list" on public.shopping_list;
drop policy if exists "Public and family manage shopping list" on public.shopping_list;
create policy "Public and family manage shopping list"
  on public.shopping_list for all
  to anon, authenticated
  using (true)
  with check (true);

-- 5. Таблица user_notes:
--    Чтение и запись (SELECT, INSERT, UPDATE, DELETE) — для anon и authenticated.
drop policy if exists "Family manage user notes" on public.user_notes;
drop policy if exists "Public and family manage user notes" on public.user_notes;
create policy "Public and family manage user notes"
  on public.user_notes for all
  to anon, authenticated
  using (true)
  with check (true);

-- 6. RPC-функция add_or_merge_shopping_item:
--    Разрешаем вызов из мобильного приложения (anon) и админки (authenticated).
grant execute on function public.add_or_merge_shopping_item(text, numeric, text, text) to anon, authenticated;
