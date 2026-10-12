-- Fase 2: bucket de fotos de produtos. Leitura pública (cardápio); escrita só dono/gerente
-- no prefixo da própria loja: <loja_id>/<arquivo aleatório>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos', 'produtos', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy produtos_fotos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'produtos'
    and public.eh_papel(((storage.foldername(name))[1])::uuid, array['dono','gerente']));
create policy produtos_fotos_update on storage.objects for update to authenticated
  using (bucket_id = 'produtos'
    and public.eh_papel(((storage.foldername(name))[1])::uuid, array['dono','gerente']));
create policy produtos_fotos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'produtos'
    and public.eh_papel(((storage.foldername(name))[1])::uuid, array['dono','gerente']));
