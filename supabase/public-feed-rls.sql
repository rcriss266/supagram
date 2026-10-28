-- Permite explorar el feed sin iniciar sesión.
-- Las escrituras siguen limitadas a usuarios autenticados por las otras políticas.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'posts'
      and policyname = 'Anyone can read posts'
  ) then
    create policy "Anyone can read posts"
      on public.posts for select to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Anyone can read public profile details'
  ) then
    create policy "Anyone can read public profile details"
      on public.profiles for select to anon, authenticated
      using (true);
  end if;
end
$$;
