alter table trainers
  add column if not exists phone text,
  add column if not exists bio text,
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public) values ('trainer-avatars', 'trainer-avatars', true)
  on conflict (id) do nothing;

create policy "Trainer upload own avatar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'trainer-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Public read trainer avatars" on storage.objects
  for select using (bucket_id = 'trainer-avatars');
