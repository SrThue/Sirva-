-- Testes de isolamento entre lojas. Falham com exceção se algo vazar.
\set ON_ERROR_STOP on
create or replace function pg_temp.como(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
end $$;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@teste.com'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@teste.com');

-- cada usuário cria a sua loja pelo caminho oficial
set role authenticated;
select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
select public.criar_loja('Loja A', 'loja-a') as loja_a \gset
select pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');
select public.criar_loja('Loja B', 'loja-b') as loja_b \gset

-- B cria produtos na sua loja
insert into public.categorias (loja_id, nome) values (:'loja_b', 'Pizzas');
insert into public.produtos (loja_id, nome, preco_centavos) values (:'loja_b', 'Calabresa', 4000);
insert into public.produtos (loja_id, nome, preco_centavos, ativo) values (:'loja_b', 'Oculto', 1, false);
insert into public.cupons (loja_id, codigo, tipo, valor) values (:'loja_b', 'SEGREDO', 'valor', 500);
insert into public.clientes (loja_id, telefone) values (:'loja_b', '85999999999');

do $$
declare n int;
begin
  -- A não vê dados privados de B
  perform pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
  select count(*) into n from public.clientes; assert n = 0, 'A leu clientes de B';
  select count(*) into n from public.cupons; assert n = 0, 'A leu cupons de B';
  select count(*) into n from public.lojas_config; assert n = 1, 'A deveria ver só a própria config';
  select count(*) into n from public.membros_loja; assert n = 1, 'A deveria ver só os próprios membros';
  select count(*) into n from public.assinaturas; assert n = 1, 'A viu assinatura alheia';
  -- A vê produto ativo de B (cardápio público) mas não o inativo
  select count(*) into n from public.produtos where nome = 'Calabresa'; assert n = 1, 'cardápio público quebrou';
  select count(*) into n from public.produtos where nome = 'Oculto'; assert n = 0, 'produto inativo vazou';
end $$;

-- A não altera nada de B
do $$
declare n int; v text;
begin
  perform pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
  update public.produtos set preco_centavos = 1; get diagnostics n = row_count;
  -- só poderia afetar produtos de A (nenhum)
  assert n = 0, 'A alterou produtos de B';
  delete from public.categorias; get diagnostics n = row_count; assert n = 0, 'A apagou categoria de B';
  update public.lojas set nome = 'hack' where slug = 'loja-b'; get diagnostics n = row_count;
  assert n = 0, 'A renomeou a loja de B';
  begin
    insert into public.produtos (loja_id, nome, preco_centavos) values ((select id from public.lojas where slug='loja-b'), 'x', 1);
    raise exception 'A inseriu produto na loja de B';
  exception when insufficient_privilege or others then
    if sqlerrm = 'A inseriu produto na loja de B' then raise; end if;
  end;
  begin
    insert into public.membros_loja values ((select id from public.lojas where slug='loja-b'), 'aaaaaaaa-0000-0000-0000-000000000001', 'dono');
    raise exception 'A se tornou dono de B';
  exception when others then
    if sqlerrm = 'A se tornou dono de B' then raise; end if;
  end;
  begin
    insert into public.lojas (slug, nome) values ('pirata', 'Pirata');
    raise exception 'insert direto em lojas permitido';
  exception when others then
    if sqlerrm = 'insert direto em lojas permitido' then raise; end if;
  end;
end $$;

-- anônimo: só cardápio público
reset role; set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$
declare n int;
begin
  select count(*) into n from public.produtos; assert n = 1, 'anon deveria ver 1 produto ativo';
  select count(*) into n from public.lojas; assert n = 2, 'anon deveria ver lojas';
  begin perform config from public.lojas_config; raise exception 'anon leu lojas_config';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.pedidos; raise exception 'anon leu pedidos';
  exception when insufficient_privilege then null; end;
  begin perform config from public.lojas; raise exception 'coluna inexistente';
  exception when undefined_column then null; end;
end $$;

-- pedido: autenticado não consegue inflar total/pago
reset role; set role authenticated;
select pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');
insert into public.pedidos (loja_id, origem, tipo, subtotal_centavos, total_centavos)
  values (:'loja_b', 'balcao', 'retirada', 1000, 1000);
do $$
begin
  begin
    update public.pedidos set pago = true;
    raise exception 'membro marcou pago direto';
  exception when insufficient_privilege then null; end;
end $$;

-- admin_plataforma e tabelas internas inacessíveis
do $$
begin
  begin perform 1 from public.admins_plataforma; raise exception 'leu admins';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.eventos_webhook; raise exception 'leu eventos';
  exception when insufficient_privilege then null; end;
end $$;

-- loja liberada: em teste, sim
reset role;
do $$
declare ok boolean;
begin
  select public.loja_liberada((select id from public.lojas where slug = 'loja-a')) into ok;
  assert ok, 'loja em teste deveria estar liberada';
  update public.assinaturas set teste_ate = now() - interval '1 day';
  select public.loja_liberada((select id from public.lojas where slug = 'loja-a')) into ok;
  assert not ok, 'teste expirado deveria bloquear';
  update public.config_plataforma set modo = 'gratis';
  select public.loja_liberada((select id from public.lojas where slug = 'loja-a')) into ok;
  assert ok, 'modo grátis deveria liberar';
end $$;

\echo 'RLS: todos os testes passaram'
