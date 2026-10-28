-- RLS para guardar likes y comentarios del usuario autenticado.
alter table public.likes enable row level security;
alter table public.comments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'likes' and policyname = 'Authenticated users can read likes') then
    create policy "Authenticated users can read likes" on public.likes
      for select to authenticated using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'likes' and policyname = 'Users can create their own likes') then
    create policy "Users can create their own likes" on public.likes
      for insert to authenticated with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'likes' and policyname = 'Users can remove their own likes') then
    create policy "Users can remove their own likes" on public.likes
      for delete to authenticated using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'comments' and policyname = 'Authenticated users can read comments') then
    create policy "Authenticated users can read comments" on public.comments
      for select to authenticated using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'comments' and policyname = 'Users can create their own comments') then
    create policy "Users can create their own comments" on public.comments
      for insert to authenticated with check (auth.uid() = user_id);
  end if;
end
$$;

-- Supabase Realtime solo emite cambios de tablas añadidas a esta publicación.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'likes') then
      alter publication supabase_realtime add table public.likes;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments') then
      alter publication supabase_realtime add table public.comments;
    end if;
  end if;
end
$$;
