-- Fase 1: funções de autorização, RLS e privilégios.

-- ───────── Funções ─────────
create function public.eh_membro(p_loja uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.membros_loja m
                 where m.loja_id = p_loja and m.usuario_id = (select auth.uid()));
$$;

create function public.eh_papel(p_loja uuid, p_papeis text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.membros_loja m
                 where m.loja_id = p_loja and m.usuario_id = (select auth.uid())
                   and m.papel = any (p_papeis));
$$;

create function public.eh_admin_plataforma() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins_plataforma a where a.usuario_id = (select auth.uid()));
$$;

-- Cadastro: cria loja + papel dono + config + assinatura (teste), em uma transação.
create function public.criar_loja(p_nome text, p_slug text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_loja uuid;
  v_cfg public.config_plataforma;
  v_teste timestamptz;
begin
  if v_uid is null then raise exception 'não autenticado' using errcode = '28000'; end if;
  insert into public.lojas (nome, slug) values (trim(p_nome), lower(trim(p_slug)))
    returning id into v_loja;
  insert into public.membros_loja (loja_id, usuario_id, papel) values (v_loja, v_uid, 'dono');
  insert into public.lojas_config (loja_id) values (v_loja);
  insert into public.cashback_regras (loja_id) values (v_loja);
  select * into v_cfg from public.config_plataforma;
  v_teste := greatest(now() + make_interval(days => v_cfg.dias_teste_padrao),
                      coalesce(v_cfg.gratis_ate, now()));
  insert into public.assinaturas (loja_id, teste_ate) values (v_loja, v_teste);
  return v_loja;
end $$;

-- Loja liberada? (checagem no servidor; nunca só na tela)
create function public.loja_liberada(p_loja uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when c.modo = 'gratis' then true
    when c.gratis_ate is not null and c.gratis_ate > now() then true
    else coalesce((select a.status = 'ativa' or (a.status = 'teste' and a.teste_ate > now())
                   from public.assinaturas a where a.loja_id = p_loja), false)
  end
  from public.config_plataforma c;
$$;

-- ───────── Privilégios: nada por padrão ─────────
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant execute on function public.eh_membro(uuid), public.eh_papel(uuid, text[]),
  public.eh_admin_plataforma(), public.criar_loja(text, text) to authenticated;
grant execute on function public.eh_membro(uuid), public.eh_papel(uuid, text[]) to anon;

-- ───────── RLS em TODAS as tabelas ─────────
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- lojas: leitura pública (só colunas públicas); escrita por dono/gerente. Criação só via criar_loja().
grant select (id, slug, nome, telefone_whatsapp, logo_url, aberta, horarios, criado_em)
  on public.lojas to anon, authenticated;
grant update (nome, telefone_whatsapp, logo_url, aberta, horarios) on public.lojas to authenticated;
grant delete on public.lojas to authenticated;
create policy lojas_leitura on public.lojas for select to anon, authenticated using (true);
create policy lojas_update on public.lojas for update to authenticated
  using (public.eh_papel(id, array['dono','gerente'])) with check (public.eh_papel(id, array['dono','gerente']));
create policy lojas_delete on public.lojas for delete to authenticated using (public.eh_papel(id, array['dono']));

grant select, update on public.lojas_config to authenticated;
create policy cfg_select on public.lojas_config for select to authenticated using (public.eh_membro(loja_id));
create policy cfg_update on public.lojas_config for update to authenticated
  using (public.eh_papel(loja_id, array['dono','gerente'])) with check (public.eh_papel(loja_id, array['dono','gerente']));

-- membros: vê os da própria loja; só o dono gerencia (e não pode se tornar outro papel por engano: ver check)
grant select, insert, update, delete on public.membros_loja to authenticated;
create policy membros_select on public.membros_loja for select to authenticated
  using (usuario_id = (select auth.uid()) or public.eh_membro(loja_id));
create policy membros_insert on public.membros_loja for insert to authenticated
  with check (public.eh_papel(loja_id, array['dono']));
create policy membros_update on public.membros_loja for update to authenticated
  using (public.eh_papel(loja_id, array['dono'])) with check (public.eh_papel(loja_id, array['dono']));
create policy membros_delete on public.membros_loja for delete to authenticated
  using (public.eh_papel(loja_id, array['dono']));

-- Cardápio: leitura pública do que está ativo; membros veem tudo; dono/gerente escrevem.
grant select on public.categorias, public.produtos, public.grupos_opcoes, public.opcoes, public.areas_entrega
  to anon, authenticated;
grant insert, update, delete on public.categorias, public.produtos, public.grupos_opcoes, public.opcoes,
  public.areas_entrega to authenticated;

create policy cat_leitura on public.categorias for select to anon, authenticated
  using (ativa or public.eh_membro(loja_id));
create policy cat_escrita on public.categorias for all to authenticated
  using (public.eh_papel(loja_id, array['dono','gerente'])) with check (public.eh_papel(loja_id, array['dono','gerente']));

create policy prod_leitura on public.produtos for select to anon, authenticated
  using (ativo or public.eh_membro(loja_id));
create policy prod_escrita on public.produtos for all to authenticated
  using (public.eh_papel(loja_id, array['dono','gerente'])) with check (public.eh_papel(loja_id, array['dono','gerente']));

create policy grp_leitura on public.grupos_opcoes for select to anon, authenticated
  using (exists (select 1 from public.produtos p where p.id = produto_id and (p.ativo or public.eh_membro(p.loja_id))));
create policy grp_escrita on public.grupos_opcoes for all to authenticated
  using (exists (select 1 from public.produtos p where p.id = produto_id and public.eh_papel(p.loja_id, array['dono','gerente'])))
  with check (exists (select 1 from public.produtos p where p.id = produto_id and public.eh_papel(p.loja_id, array['dono','gerente'])));

create policy opc_leitura on public.opcoes for select to anon, authenticated
  using (exists (select 1 from public.grupos_opcoes g join public.produtos p on p.id = g.produto_id
                 where g.id = grupo_id and (p.ativo or public.eh_membro(p.loja_id))));
create policy opc_escrita on public.opcoes for all to authenticated
  using (exists (select 1 from public.grupos_opcoes g join public.produtos p on p.id = g.produto_id
                 where g.id = grupo_id and public.eh_papel(p.loja_id, array['dono','gerente'])))
  with check (exists (select 1 from public.grupos_opcoes g join public.produtos p on p.id = g.produto_id
                 where g.id = grupo_id and public.eh_papel(p.loja_id, array['dono','gerente'])));

create policy area_leitura on public.areas_entrega for select to anon, authenticated using (true);
create policy area_escrita on public.areas_entrega for all to authenticated
  using (public.eh_papel(loja_id, array['dono','gerente'])) with check (public.eh_papel(loja_id, array['dono','gerente']));

-- Dados de loja só para membros. Pedido do cliente passa pelo servidor (service_role).
grant select, insert, update, delete on public.clientes, public.cupons, public.cashback_regras,
  public.mesas, public.comandas, public.caixa_sessoes, public.conversas_whatsapp to authenticated;
grant select, insert on public.pedidos to authenticated;
grant update (status, observacao, forma_pagamento) on public.pedidos to authenticated; -- total e pago só pelo servidor
grant select on public.itens_pedido, public.historico_status, public.pagamentos,
  public.cashback_movimentos, public.mensagens_whatsapp, public.caixa_movimentos,
  public.assinaturas, public.config_plataforma, public.auditoria to authenticated;
grant insert on public.itens_pedido, public.caixa_movimentos to authenticated;

create policy clientes_membros on public.clientes for all to authenticated
  using (public.eh_membro(loja_id)) with check (public.eh_membro(loja_id));
create policy cupons_leitura on public.cupons for select to authenticated using (public.eh_membro(loja_id));
create policy cupons_escrita on public.cupons for all to authenticated
  using (public.eh_papel(loja_id, array['dono','gerente'])) with check (public.eh_papel(loja_id, array['dono','gerente']));
create policy cashback_regras_leitura on public.cashback_regras for select to authenticated using (public.eh_membro(loja_id));
create policy cashback_regras_escrita on public.cashback_regras for all to authenticated
  using (public.eh_papel(loja_id, array['dono','gerente'])) with check (public.eh_papel(loja_id, array['dono','gerente']));
create policy mesas_membros on public.mesas for all to authenticated
  using (public.eh_membro(loja_id)) with check (public.eh_membro(loja_id));
create policy comandas_membros on public.comandas for all to authenticated
  using (public.eh_membro(loja_id)) with check (public.eh_membro(loja_id));
create policy caixa_sessoes_membros on public.caixa_sessoes for all to authenticated
  using (public.eh_papel(loja_id, array['dono','gerente','atendente']))
  with check (public.eh_papel(loja_id, array['dono','gerente','atendente']));
create policy conversas_membros on public.conversas_whatsapp for all to authenticated
  using (public.eh_papel(loja_id, array['dono','gerente','atendente']))
  with check (public.eh_papel(loja_id, array['dono','gerente','atendente']));

create policy pedidos_select on public.pedidos for select to authenticated using (public.eh_membro(loja_id));
create policy pedidos_insert on public.pedidos for insert to authenticated
  with check (public.eh_papel(loja_id, array['dono','gerente','atendente','garcom']));
create policy pedidos_update on public.pedidos for update to authenticated
  using (public.eh_membro(loja_id)) with check (public.eh_membro(loja_id));

create policy itens_select on public.itens_pedido for select to authenticated
  using (exists (select 1 from public.pedidos p where p.id = pedido_id and public.eh_membro(p.loja_id)));
create policy itens_insert on public.itens_pedido for insert to authenticated
  with check (exists (select 1 from public.pedidos p where p.id = pedido_id
                      and public.eh_papel(p.loja_id, array['dono','gerente','atendente','garcom'])));
create policy hist_select on public.historico_status for select to authenticated
  using (exists (select 1 from public.pedidos p where p.id = pedido_id and public.eh_membro(p.loja_id)));
create policy pag_select on public.pagamentos for select to authenticated
  using (exists (select 1 from public.pedidos p where p.id = pedido_id and public.eh_membro(p.loja_id)));
create policy cbm_select on public.cashback_movimentos for select to authenticated
  using (exists (select 1 from public.clientes c where c.id = cliente_id and public.eh_membro(c.loja_id)));
create policy msg_select on public.mensagens_whatsapp for select to authenticated
  using (exists (select 1 from public.conversas_whatsapp c where c.id = conversa_id and public.eh_membro(c.loja_id)));
create policy cxm_select on public.caixa_movimentos for select to authenticated
  using (exists (select 1 from public.caixa_sessoes s where s.id = sessao_id and public.eh_membro(s.loja_id)));
create policy cxm_insert on public.caixa_movimentos for insert to authenticated
  with check (exists (select 1 from public.caixa_sessoes s where s.id = sessao_id
                      and public.eh_papel(s.loja_id, array['dono','gerente','atendente'])));

-- Histórico de status e pagamentos são gravados pelo servidor (service_role); membros só leem.

-- Plataforma
create policy assin_select on public.assinaturas for select to authenticated
  using (public.eh_membro(loja_id) or public.eh_admin_plataforma());
create policy cfgp_select on public.config_plataforma for select to authenticated using (true);
create policy aud_select on public.auditoria for select to authenticated
  using (loja_id is not null and public.eh_papel(loja_id, array['dono']));
-- admins_plataforma, eventos_webhook, politica_retencao: RLS ativo e sem policy = só service_role.
-- Alterações em config_plataforma/assinaturas: somente pelo servidor (service_role) após checar admin.
