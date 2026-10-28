-- Permite leer publicaciones y crear publicaciones solo a nombre del usuario autenticado.
alter table public.posts enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'posts'
      and policyname = 'Authenticated users can read posts'
  ) then
    create policy "Authenticated users can read posts"
      on public.posts
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'posts'
      and policyname = 'Users can create their own posts'
  ) then
    create policy "Users can create their own posts"
      on public.posts
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end
$$;

-- El formulario guarda los archivos dentro de supagram/images/.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can upload Supagram images'
  ) then
    create policy "Authenticated users can upload Supagram images"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'supagram'
        and (storage.foldername(name))[1] = 'images'
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can list Supagram images'
  ) then
    create policy "Authenticated users can list Supagram images"
      on storage.objects
      for select
      to authenticated
      using (bucket_id = 'supagram');
  end if;
end
$$;
