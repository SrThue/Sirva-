-- Loja de exemplo (somente desenvolvimento). Se existir um usuário dono@exemplo.com
-- (crie pelo cadastro), ele vira dono da loja.
insert into public.lojas (id, slug, nome, aberta)
values ('11111111-1111-1111-1111-111111111111', 'pizzaria-exemplo', 'Pizzaria Exemplo', true)
on conflict do nothing;
insert into public.lojas_config (loja_id) values ('11111111-1111-1111-1111-111111111111') on conflict do nothing;
insert into public.cashback_regras (loja_id) values ('11111111-1111-1111-1111-111111111111') on conflict do nothing;
insert into public.assinaturas (loja_id, teste_ate)
values ('11111111-1111-1111-1111-111111111111', now() + interval '30 days') on conflict do nothing;

insert into public.categorias (id, loja_id, nome, ordem) values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111111', 'Pizzas', 1),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111111', 'Bebidas', 2)
on conflict do nothing;
insert into public.produtos (loja_id, categoria_id, nome, descricao, preco_centavos, destaque) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222201', 'Calabresa', 'Molho, mussarela, calabresa e cebola', 4500, true),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222201', 'Marguerita', 'Molho, mussarela, tomate e manjericão', 4200, false),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222202', 'Refrigerante 2L', null, 1200, false);

insert into public.membros_loja (loja_id, usuario_id, papel)
select '11111111-1111-1111-1111-111111111111', id, 'dono' from auth.users where email = 'dono@exemplo.com'
on conflict do nothing;
