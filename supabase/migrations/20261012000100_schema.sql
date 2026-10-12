-- Fase 1: schema base do Sirvaí. Valores em centavos; datas em UTC.

-- ───────── Lojas (tenant) ─────────
create table public.lojas (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$'),
  nome text not null check (char_length(nome) between 2 and 80),
  telefone_whatsapp text,
  logo_url text,
  aberta boolean not null default false,
  horarios jsonb not null default '{}',
  criado_em timestamptz not null default now()
);

-- Regras internas da loja (separadas de lojas para não ficarem públicas)
create table public.lojas_config (
  loja_id uuid primary key references public.lojas on delete cascade,
  config jsonb not null default '{}'
);

create table public.membros_loja (
  loja_id uuid not null references public.lojas on delete cascade,
  usuario_id uuid not null references auth.users on delete cascade,
  papel text not null check (papel in ('dono','gerente','atendente','garcom','entregador')),
  primary key (loja_id, usuario_id)
);
create index on public.membros_loja (usuario_id);

-- ───────── Cardápio ─────────
create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas on delete cascade,
  nome text not null, ordem int not null default 0, ativa boolean not null default true
);
create index on public.categorias (loja_id);

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas on delete cascade,
  categoria_id uuid references public.categorias on delete set null,
  nome text not null, descricao text, foto_url text,
  preco_centavos int not null check (preco_centavos >= 0),
  selos text[] not null default '{}',
  destaque boolean not null default false,
  ativo boolean not null default true,
  estoque int,
  ordem int not null default 0
);
create index on public.produtos (loja_id, categoria_id);

create table public.grupos_opcoes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos on delete cascade,
  nome text not null, minimo int not null default 0, maximo int not null default 1,
  obrigatorio boolean not null default false
);
create index on public.grupos_opcoes (produto_id);

create table public.opcoes (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos_opcoes on delete cascade,
  nome text not null, adicional_centavos int not null default 0, ativa boolean not null default true
);
create index on public.opcoes (grupo_id);

-- ───────── Clientes e entrega ─────────
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas on delete cascade,
  nome text, telefone text not null,
  saldo_cashback_centavos int not null default 0 check (saldo_cashback_centavos >= 0),
  consentimento_marketing boolean not null default false,
  unique (loja_id, telefone)
);

create table public.areas_entrega (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas on delete cascade,
  tipo text not null check (tipo in ('bairro','raio','poligono')),
  nome text, definicao jsonb not null,
  taxa_centavos int not null check (taxa_centavos >= 0),
  pedido_minimo_centavos int not null default 0, prazo_minutos int
);
create index on public.areas_entrega (loja_id);

-- ───────── Salão ─────────
create table public.mesas (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas on delete cascade,
  numero text not null,
  qr_token text unique not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  status text not null default 'livre',
  unique (loja_id, numero)
);

create table public.comandas (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas on delete cascade,
  mesa_id uuid references public.mesas, identificador text,
  aberta boolean not null default true,
  aberta_em timestamptz not null default now(), fechada_em timestamptz
);
create index on public.comandas (loja_id);

-- ───────── Marketing ─────────
create table public.cupons (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas on delete cascade,
  codigo text not null, tipo text not null check (tipo in ('percentual','valor')),
  valor int not null check (valor > 0), usos_max int, usos int not null default 0,
  valido_de timestamptz, valido_ate timestamptz, ativo boolean not null default true,
  unique (loja_id, codigo)
);

create table public.cashback_regras (
  loja_id uuid primary key references public.lojas on delete cascade,
  ativo boolean not null default false,
  percentual numeric(5,2) not null default 0 check (percentual between 0 and 100),
  dias_semana int[] not null default '{0,1,2,3,4,5,6}',
  validade_dias int not null default 30
);

-- ───────── Pedidos ─────────
create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  token_acompanhamento text not null default replace(gen_random_uuid()::text, '-', ''),
  loja_id uuid not null references public.lojas on delete cascade,
  cliente_id uuid references public.clientes,
  origem text not null check (origem in ('cardapio','whatsapp','garcom','qrcode_mesa','balcao')),
  tipo text not null check (tipo in ('entrega','retirada','salao')),
  status text not null default 'novo' check (status in
    ('aguardando_pagamento','novo','aceito','preparo','pronto','saiu_entrega','entregue','cancelado')),
  mesa_id uuid references public.mesas, comanda_id uuid references public.comandas,
  endereco jsonb, observacao text,
  agendado_para timestamptz,
  subtotal_centavos int not null check (subtotal_centavos >= 0),
  taxa_entrega_centavos int not null default 0,
  desconto_centavos int not null default 0,
  total_centavos int not null check (total_centavos >= 0),
  cupom_id uuid references public.cupons, cashback_usado_centavos int not null default 0,
  forma_pagamento text, pago boolean not null default false,
  criado_em timestamptz not null default now()
);
create index on public.pedidos (loja_id, criado_em desc);
create index on public.pedidos (loja_id, status);

create table public.itens_pedido (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos on delete cascade,
  produto_id uuid references public.produtos,
  nome_snapshot text not null, quantidade int not null check (quantidade > 0),
  preco_unit_centavos int not null check (preco_unit_centavos >= 0),
  opcoes jsonb not null default '[]', observacao text
);
create index on public.itens_pedido (pedido_id);

create table public.historico_status (
  id bigint generated always as identity primary key,
  pedido_id uuid not null references public.pedidos on delete cascade,
  status text not null, usuario_id uuid, em timestamptz not null default now()
);
create index on public.historico_status (pedido_id);

create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos on delete cascade,
  provedor text, provedor_ref text, metodo text,
  valor_centavos int not null check (valor_centavos >= 0),
  status text not null default 'pendente'
    check (status in ('pendente','aprovado','recusado','expirado','estornado')),
  pix_copia_cola text, expira_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (provedor, provedor_ref)
);
create index on public.pagamentos (pedido_id);

create table public.cashback_movimentos (
  id bigint generated always as identity primary key,
  cliente_id uuid not null references public.clientes,
  pedido_id uuid references public.pedidos,
  tipo text not null check (tipo in ('credito','uso','expiracao')),
  valor_centavos int not null, criado_em timestamptz not null default now()
);
create index on public.cashback_movimentos (cliente_id);

-- ───────── WhatsApp / IA ─────────
create table public.conversas_whatsapp (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas on delete cascade,
  telefone text not null, humano_assumiu boolean not null default false,
  contexto jsonb not null default '{}', atualizada_em timestamptz not null default now(),
  unique (loja_id, telefone)
);

create table public.mensagens_whatsapp (
  id bigint generated always as identity primary key,
  conversa_id uuid not null references public.conversas_whatsapp on delete cascade,
  direcao text not null check (direcao in ('entrada','saida')), tipo text, conteudo text,
  criada_em timestamptz not null default now()
);
create index on public.mensagens_whatsapp (conversa_id);

-- ───────── Caixa ─────────
create table public.caixa_sessoes (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas on delete cascade,
  aberto_por uuid, valor_inicial_centavos int not null default 0,
  aberto_em timestamptz not null default now(), fechado_em timestamptz, valor_final_centavos int
);

create table public.caixa_movimentos (
  id bigint generated always as identity primary key,
  sessao_id uuid not null references public.caixa_sessoes on delete cascade,
  tipo text not null check (tipo in ('entrada','saida','venda')), descricao text,
  valor_centavos int not null, criado_em timestamptz not null default now()
);

-- ───────── Plataforma (pago x grátis, assinaturas) ─────────
create table public.admins_plataforma (
  usuario_id uuid primary key references auth.users on delete cascade
);

create table public.config_plataforma (
  id boolean primary key default true check (id), -- linha única
  modo text not null default 'pago' check (modo in ('pago','gratis')),
  gratis_ate timestamptz,
  dias_teste_padrao int not null default 30 check (dias_teste_padrao >= 0)
);
insert into public.config_plataforma default values;

create table public.assinaturas (
  loja_id uuid primary key references public.lojas on delete cascade,
  plano text not null default 'basico',
  status text not null default 'teste' check (status in ('teste','ativa','atrasada','cancelada')),
  teste_ate timestamptz
);

-- ───────── Segurança, LGPD e integrações ─────────
create table public.eventos_webhook (
  origem text not null, evento_id text not null,
  recebido_em timestamptz not null default now(),
  primary key (origem, evento_id)
);

create table public.auditoria (
  id bigint generated always as identity primary key,
  loja_id uuid references public.lojas on delete set null,
  usuario_id uuid, acao text not null, detalhes jsonb not null default '{}',
  ip inet, em timestamptz not null default now()
);
create index on public.auditoria (loja_id, em desc);

create table public.politica_retencao (
  tipo_dado text primary key, dias int not null check (dias > 0), acao text not null default 'anonimizar'
    check (acao in ('anonimizar','apagar'))
);
insert into public.politica_retencao (tipo_dado, dias, acao) values
  ('conversas_whatsapp', 90, 'apagar'), ('logs_tecnicos', 90, 'apagar');
