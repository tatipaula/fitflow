alter table athletes
  add column if not exists birth_date date,
  add column if not exists height_cm numeric,
  add column if not exists objective text,
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

create policy "Athlete upload own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (
      select id::text from athletes where auth_user_id = auth.uid() limit 1
    )
  );

create policy "Public read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');
