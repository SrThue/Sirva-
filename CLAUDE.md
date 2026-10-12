# SIRVAÍ — Plataforma de delivery e salão para restaurantes

> Cole este arquivo inteiro no Claude Code (ou salve como `CLAUDE.md` na raiz do repositório) e peça:
> **"Leia o CLAUDE.md e execute a Fase 0. Ao terminar cada fase, pare e me mostre o resultado."**

---

## 1. Missão

Construir o **Sirvaí**, um SaaS multi-loja (multi-tenant) em que restaurantes, pizzarias, açaíterias e lanchonetes:

- recebem pedidos por **cardápio digital** (link, QR Code e modo garçom);
- atendem automaticamente por **WhatsApp** com um **atendente virtual com IA**;
- gerenciam pedidos em tempo real, cobram por **Pix** e têm **marketing** (cupons e cashback);
- operam o **salão** (mesas, comandas, app do garçom);
- **sem comissão por pedido** (cobrança por mensalidade).

Tudo em português do Brasil, mobile-first, rápido em celular barato.

## 2. Stack (obrigatória)

| Camada | Tecnologia |
|---|---|
| Frontend + API | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui |
| Banco, Auth, Realtime, Storage | **Supabase** (Postgres + RLS) |
| Hospedagem | **Vercel** |
| Código e CI | **GitHub** (GitHub Actions) |
| Pagamentos | **Mercado Pago** (Pix primeiro), atrás de um adapter para trocar de provedor no futuro |
| WhatsApp | WhatsApp Cloud API (Meta), via webhook |
| IA do atendente | Claude API (Anthropic), com tool use |
| Validação | Zod |
| Testes | Vitest (unidade) + Playwright (fluxo principal) |

## 3. Melhorias em relação ao Anota AI

Reclamações comuns de lojistas e como resolver:

1. **Sem app para iPhone e alerta sonoro fraco** → fazer um **PWA instalável** (iOS e Android), com som alto e repetitivo até o pedido ser aceito, fila de pedidos pendentes e botão "testar som".
2. **Operação presa a notebook** → painel 100% responsivo, usável só no celular.
3. **Pedido sem dono** → status claros (novo, aceito, em preparo, pronto, saiu para entrega, entregue, cancelado) com histórico e horário de cada mudança.
4. **Cupom e cashback não combinam** → permitir regra configurável por loja (combinar ou não).
5. **Entrega por raio limitada** → área de entrega por bairro, por raio **ou** por polígono, com taxa por faixa.
6. **Configuração demorada** → assistente de onboarding em 5 passos e importação de cardápio por planilha CSV.
7. **Pouca visão dos números** → painel com faturamento, ticket médio, produtos mais vendidos, horários de pico e recompra.
8. **Cliente precisa se cadastrar** → pedido com apenas nome e telefone (verificação opcional por código no WhatsApp).

## 4. Regras de trabalho (o Claude Code deve seguir sempre)

- Trabalhar em **fases**. Ao final de cada uma: rodar lint, typecheck e testes, fazer commit e **parar** para eu validar.
- Commits pequenos no padrão Conventional Commits (`feat:`, `fix:`, `chore:`).
- Uma branch por fase (`fase-1-banco`, etc.) e Pull Request para `main`.
- **Nunca** colocar chaves, tokens ou senhas no código. Usar `.env.local` (ignorado pelo git) e variáveis da Vercel. Manter `.env.example` atualizado.
- Toda tabela com dados de loja deve ter **RLS ativado**. Nenhuma tabela pública sem política.
- Mudanças de banco **somente por migrations** versionadas em `supabase/migrations`.
- Chaves `service_role` só no servidor, nunca no navegador.
- Textos da interface em pt-BR; valores em centavos (inteiros) no banco; datas em UTC, exibidas em America/Fortaleza.
- Acessibilidade básica (contraste, rótulos, foco) e carregamento rápido (imagens otimizadas, listas paginadas).
- Se uma decisão for ambígua, escolher a opção mais simples e anotar em `docs/decisoes.md`.

## 5. Estrutura do repositório

```
sirvai/
├─ CLAUDE.md
├─ README.md
├─ .env.example
├─ .github/workflows/ci.yml
├─ docs/
│  ├─ decisoes.md
│  └─ arquitetura.md
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/
│  └─ seed.sql
├─ src/
│  ├─ app/
│  │  ├─ (marketing)/            # página inicial e preços
│  │  ├─ (auth)/                 # login e cadastro
│  │  ├─ painel/                 # área do lojista
│  │  │  ├─ pedidos/
│  │  │  ├─ cardapio/
│  │  │  ├─ salao/
│  │  │  ├─ marketing/
│  │  │  ├─ relatorios/
│  │  │  └─ configuracoes/
│  │  ├─ [slug]/                 # cardápio público da loja
│  │  │  ├─ carrinho/
│  │  │  ├─ checkout/
│  │  │  └─ pedido/[id]/         # acompanhamento
│  │  ├─ garcom/[slug]/          # app do garçom (PWA)
│  │  └─ api/
│  │     ├─ webhooks/whatsapp/
│  │     ├─ webhooks/pagamento/
│  │     └─ ...
│  ├─ components/
│  ├─ lib/
│  │  ├─ supabase/ (client, server, admin)
│  │  ├─ pagamentos/ (adapter, mercadopago, asaas)
│  │  ├─ whatsapp/
│  │  ├─ ia/ (agente de atendimento)
│  │  └─ utils/
│  └─ types/
└─ tests/
```

## 6. Modelo de dados (base)

Criar nas migrations (ajustar nomes se necessário, mantendo a lógica):

```sql
-- Lojas (tenant)
create table lojas (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nome text not null,
  telefone_whatsapp text,
  logo_url text,
  aberta boolean default false,
  horarios jsonb default '{}',
  config jsonb default '{}',      -- regras (cupom+cashback, pedido mínimo, etc.)
  criado_em timestamptz default now()
);

-- Quem pode acessar cada loja
create table membros_loja (
  loja_id uuid references lojas on delete cascade,
  usuario_id uuid references auth.users on delete cascade,
  papel text check (papel in ('dono','gerente','atendente','garcom','entregador')),
  primary key (loja_id, usuario_id)
);

-- Cardápio
create table categorias (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references lojas on delete cascade,
  nome text not null, ordem int default 0, ativa boolean default true
);

create table produtos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references lojas on delete cascade,
  categoria_id uuid references categorias on delete set null,
  nome text not null, descricao text, foto_url text,
  preco_centavos int not null check (preco_centavos >= 0),
  selos text[] default '{}',       -- vegano, sem_gluten, sem_lactose...
  destaque boolean default false,
  ativo boolean default true,
  estoque int,                     -- null = sem controle
  ordem int default 0
);

create table grupos_opcoes (       -- ex.: "Escolha o tamanho", "Adicionais"
  id uuid primary key default gen_random_uuid(),
  produto_id uuid references produtos on delete cascade,
  nome text not null, minimo int default 0, maximo int default 1, obrigatorio boolean default false
);

create table opcoes (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid references grupos_opcoes on delete cascade,
  nome text not null, adicional_centavos int default 0, ativa boolean default true
);

-- Clientes e endereços
create table clientes (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references lojas on delete cascade,
  nome text, telefone text not null,
  saldo_cashback_centavos int default 0,
  unique (loja_id, telefone)
);

-- Entrega
create table areas_entrega (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references lojas on delete cascade,
  tipo text check (tipo in ('bairro','raio','poligono')),
  nome text, definicao jsonb not null,
  taxa_centavos int not null, pedido_minimo_centavos int default 0, prazo_minutos int
);

-- Pedidos
create table pedidos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  loja_id uuid references lojas on delete cascade,
  cliente_id uuid references clientes,
  origem text check (origem in ('cardapio','whatsapp','garcom','qrcode_mesa','balcao')),
  tipo text check (tipo in ('entrega','retirada','salao')),
  status text default 'novo' check (status in
    ('novo','aceito','preparo','pronto','saiu_entrega','entregue','cancelado')),
  mesa_id uuid, comanda_id uuid,
  endereco jsonb, observacao text,
  agendado_para timestamptz,
  subtotal_centavos int not null, taxa_entrega_centavos int default 0,
  desconto_centavos int default 0, total_centavos int not null,
  cupom_id uuid, cashback_usado_centavos int default 0,
  forma_pagamento text, pago boolean default false,
  criado_em timestamptz default now()
);

create table itens_pedido (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references pedidos on delete cascade,
  produto_id uuid references produtos,
  nome_snapshot text, quantidade int not null,
  preco_unit_centavos int not null, opcoes jsonb default '[]', observacao text
);

create table historico_status (
  id bigint generated always as identity primary key,
  pedido_id uuid references pedidos on delete cascade,
  status text, usuario_id uuid, em timestamptz default now()
);

-- Pagamentos
create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references pedidos on delete cascade,
  provedor text, provedor_ref text, metodo text,
  valor_centavos int, status text default 'pendente', pix_copia_cola text,
  criado_em timestamptz default now()
);

-- Marketing
create table cupons (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references lojas on delete cascade,
  codigo text not null, tipo text check (tipo in ('percentual','valor')),
  valor int not null, usos_max int, usos int default 0,
  valido_de timestamptz, valido_ate timestamptz, ativo boolean default true,
  unique (loja_id, codigo)
);

create table cashback_regras (
  loja_id uuid primary key references lojas on delete cascade,
  ativo boolean default false, percentual numeric(5,2) default 0,
  dias_semana int[] default '{0,1,2,3,4,5,6}', validade_dias int default 30
);

create table cashback_movimentos (
  id bigint generated always as identity primary key,
  cliente_id uuid references clientes, pedido_id uuid references pedidos,
  tipo text check (tipo in ('credito','uso','expiracao')),
  valor_centavos int, criado_em timestamptz default now()
);

-- Salão
create table mesas (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references lojas on delete cascade,
  numero text not null, qr_token text unique default encode(gen_random_bytes(12),'hex'),
  status text default 'livre'
);

create table comandas (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references lojas on delete cascade,
  mesa_id uuid references mesas, identificador text,
  aberta boolean default true, aberta_em timestamptz default now(), fechada_em timestamptz
);

-- WhatsApp / IA
create table conversas_whatsapp (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references lojas on delete cascade,
  telefone text not null, humano_assumiu boolean default false,
  contexto jsonb default '{}', atualizada_em timestamptz default now()
);

create table mensagens_whatsapp (
  id bigint generated always as identity primary key,
  conversa_id uuid references conversas_whatsapp on delete cascade,
  direcao text check (direcao in ('entrada','saida')), tipo text, conteudo text,
  criada_em timestamptz default now()
);

-- Caixa
create table caixa_sessoes (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references lojas on delete cascade,
  aberto_por uuid, valor_inicial_centavos int default 0,
  aberto_em timestamptz default now(), fechado_em timestamptz, valor_final_centavos int
);

create table caixa_movimentos (
  id bigint generated always as identity primary key,
  sessao_id uuid references caixa_sessoes on delete cascade,
  tipo text check (tipo in ('entrada','saida','venda')), descricao text,
  valor_centavos int, criado_em timestamptz default now()
);
```

**RLS (padrão):** criar a função `eh_membro(loja_id uuid)` que verifica `membros_loja` para `auth.uid()`. Políticas de leitura e escrita do painel usam essa função. O cardápio público lê apenas lojas, categorias, produtos e opções ativos. Criação de pedido pelo cliente passa por **rota de API no servidor** (validação de preços no servidor, nunca confiar no valor vindo do navegador).

## 7. Fases de execução

### Fase 0: Fundação
- Criar repositório Next.js + TypeScript + Tailwind + shadcn/ui.
- Configurar ESLint, Prettier, Vitest, Playwright.
- Criar `.env.example`, `README.md` e o workflow `ci.yml` (lint + typecheck + testes).
- Inicializar Supabase local (`supabase init`) e conectar ao projeto.
- Conectar o repositório ao GitHub e à Vercel (deploy de preview por PR).
- **Entrega:** site no ar com página "Sirvaí" e CI verde.

### Fase 1: Banco, autenticação e multi-loja
- Escrever as migrations do item 6 e a função `eh_membro`, com RLS completo.
- Login por e-mail e senha (Supabase Auth). Cadastro cria usuário, loja e papel "dono".
- Seed com uma loja de exemplo.
- Testes de RLS: um usuário não pode ler nem alterar dados de outra loja.
- **Entrega:** cadastro, login e troca de loja funcionando.

### Fase 2: Painel — cardápio
- CRUD de categorias, produtos (foto no Supabase Storage), grupos de opções e adicionais.
- Selos alimentares, destaque, ativar/pausar produto, ordenação por arrastar.
- Importação por CSV e modelo de planilha para baixar.
- Configurações da loja: horários, aberta/fechada, áreas e taxas de entrega.
- **Entrega:** lojista monta um cardápio completo pelo celular.

### Fase 3: Cardápio público e pedido
- Página `/{slug}` rápida (SSR/ISR), com busca, categorias fixas, selos e destaques.
- Carrinho, escolha de opções, observação por item e sugestões "Peça também".
- Checkout: nome, telefone, tipo (entrega, retirada), endereço, área/taxa, agendamento e cupom.
- API de criação de pedido que **recalcula tudo no servidor**.
- Tela de acompanhamento `/{slug}/pedido/{id}` com atualização em tempo real e "Pedir de novo".
- **Entrega:** cliente faz um pedido completo, que aparece no banco.

### Fase 4: Gerenciador de pedidos (PWA)
- Quadro em tempo real (Supabase Realtime) por status, com contadores.
- **Alerta sonoro alto e repetido** para novos pedidos, notificação push (Web Push) e botão de testar.
- PWA instalável em iOS e Android, com ícone, manifest e service worker.
- Aceitar, recusar com motivo, avançar status e histórico de horários.
- Impressão de comanda (CSS de impressão 58/80 mm) e botão de compartilhar pedido.
- Atribuir entregador e página simples do entregador.
- **Entrega:** lojista opera o dia inteiro só pelo celular.

### Fase 5: Pagamento online
- Seguir **à risca a Seção 12 (Pagamentos)**: interface `ProvedorPagamento` com `criarPix`, `consultar` e `tratarWebhook`; implementar primeiro com **Pix** do Mercado Pago (copia e cola + QR).
- Webhook que só *avisa*; o servidor sempre confirma consultando a API do provedor, com verificação de assinatura e idempotência.
- Pagar na entrega (dinheiro com troco, cartão) como opção por loja.
- Cartão e carteiras digitais ficam para depois (deixar o adapter preparado).
- **Entrega:** pedido pago por Pix muda sozinho para "pago".

### Fase 6: Marketing
- Cupons (percentual ou valor, limite de uso, validade, ilimitados para parcerias).
- Cashback com regras por dia da semana, percentual e validade.
- Regra por loja: cupom e cashback combinam ou não.
- "Compre mais e ganhe mais" (brinde ou desconto por valor).
- Campos para Pixel (Meta/Google) por loja, injetados no cardápio público.
- **Entrega:** relatório simples de uso de cupons e cashback.

### Fase 7: Salão
- Cadastro de mesas com **QR Code** por mesa e página imprimível.
- Cardápio por QR com botão "Chamar garçom" (notificação em tempo real).
- App do garçom (`/garcom/{slug}`, PWA): abrir comanda por mesa ou pessoa, lançar itens, enviar à cozinha, fechar conta, dividir conta.
- Frente de caixa: abrir e fechar caixa, entradas, saídas e vendas; relatório por garçom.
- (Opcional) leitura de comanda por QR/código de barras e campo de peso para venda por quilo.
- **Entrega:** salão funcionando de ponta a ponta.

### Fase 8: Atendente virtual no WhatsApp com IA
- Webhook da WhatsApp Cloud API: receber texto e áudio (transcrever o áudio), responder, marcar como lida.
- Agente com Claude API e **tool use**, sem inventar preço ou produto. Ferramentas: `buscar_cardapio`, `adicionar_item`, `ver_carrinho`, `calcular_entrega`, `aplicar_cupom`, `finalizar_pedido`, `chamar_humano`.
- Sempre confirmar o resumo do pedido (itens, endereço, total, forma de pagamento) antes de finalizar.
- Botão "assumir conversa" no painel, que pausa o robô; horário de funcionamento respeitado.
- Mensagens automáticas de status do pedido e pesquisa de satisfação.
- Limites de custo: máximo de mensagens por conversa, cache do cardápio, logs de uso.
- **Entrega:** pedido completo feito por conversa e, por áudio, caindo no painel.

### Fase 9: Relatórios e planos
- Painel: faturamento, nº de pedidos, ticket médio, mais vendidos, horários de pico, recompra, cupons e cashback.
- Exportar CSV.
- Planos e assinatura (cobrança mensal do próprio Sirvaí), com teste grátis (padrão de 30 dias, configurável, ver Seção 10) sem cartão e bloqueio suave ao expirar.
- **Entrega:** lojista enxerga o que dá lucro.

### Fase 10: Qualidade e lançamento
- Testes E2E do fluxo: cadastro → cardápio → pedido → aceite → pagamento.
- Auditoria de segurança (RLS, rate limit em APIs públicas, validação Zod, CORS, headers).
- Performance (Lighthouse mobile acima de 90 no cardápio público).
- Termos de uso, política de privacidade e consentimento (LGPD); exclusão de dados do cliente sob pedido.
- Monitoramento de erros e logs na Vercel; backups do Supabase.
- Domínio próprio e documentação em `docs/`.

## 8. Variáveis de ambiente (`.env.example`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # só servidor
NEXT_PUBLIC_APP_URL=
MERCADOPAGO_ACCESS_TOKEN=         # ou ASAAS_API_KEY
PAGAMENTO_WEBHOOK_SECRET=
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
ANTHROPIC_API_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

## 9. Definição de pronto (para cada fase)

- [ ] Funciona no celular (testado em tela estreita)
- [ ] Lint, typecheck e testes passando
- [ ] RLS e validações Zod revisados (Seção 11) e teste de isolamento entre lojas passando
- [ ] Nenhum segredo no código ou no bundle do cliente; webhooks com assinatura e deduplicação
- [ ] Dados pessoais mascarados nos logs e política de retenção respeitada (Seção 13)
- [ ] Migration criada (se mudou o banco)
- [ ] README/docs atualizados
- [ ] Pull Request aberto e preview da Vercel funcionando

## 10. Parâmetros herdados do Gravei

Mesmas decisões do projeto Gravei, aplicadas ao Sirvaí:

| Parâmetro | Valor no Sirvaí |
|---|---|
| Pagamento | Pix pelo **Mercado Pago** |
| Dados | **Supabase** |
| Hospedagem | **Vercel** |
| Pago x grátis | **Página de administrador** que alterna o sistema entre pago e grátis, gravada no Supabase |
| Período de teste | Configurável de duas formas: **grátis para todos até uma data** e **N dias grátis por loja** (padrão: **30 dias**) |
| Identidade | Nome em minúsculas ("sirvaí") e paleta **Violeta noite** (podem ser trocados depois) |
| Retenção | Prazo de guarda de dados definido e configurável (no Gravei, vídeos por 1 semana; aqui, ver Seção 13) |

Tabela de apoio (migration): `config_plataforma` (modo `pago|gratis`, `gratis_ate`, `dias_teste_padrao`) e `assinaturas` (loja, plano, status, `teste_ate`). Somente o papel `admin_plataforma` altera. A checagem de "loja liberada?" acontece **no servidor**, nunca só na tela.

### Onde NÃO copiar o Gravei (decisão de segurança)

1. **Login por nome completo + data de nascimento como senha:** não usar. É previsível, fácil de descobrir e transforma dado pessoal em credencial. Usar Supabase Auth com **e-mail + senha forte** ou **link mágico**, e 2FA opcional para dono.
2. **Supabase compartilhado com outros apps (EDU_Corpo 1):** não usar. Um erro de política em um app expõe os outros, e a LGPD exige separar finalidades. Criar um **projeto Supabase exclusivo** do Sirvaí (região São Paulo), com projetos separados para desenvolvimento e produção.

## 11. Segurança no back end (obrigatório)

### 11.1 Princípio: o navegador nunca é confiável
- Toda regra de negócio no servidor (Route Handlers / Server Actions). Preço, taxa, cupom, cashback, estoque e total são **sempre recalculados no servidor** a partir do banco.
- `SUPABASE_SERVICE_ROLE_KEY`, tokens do Mercado Pago, WhatsApp e Anthropic: **somente servidor**. Nunca com prefixo `NEXT_PUBLIC_`. Teste automático que falha o build se uma dessas chaves aparecer no bundle do cliente.
- Validar **toda** entrada com Zod (corpo, query, headers, parâmetros). Rejeitar campos desconhecidos.
- Autorização em duas camadas: **RLS no banco** + checagem de papel na rota. Mesmo com a rota correta, o banco deve negar acesso indevido.
- Rate limit nas rotas públicas (criar pedido, validar cupom, login, webhooks, busca de cliente por telefone), com limites por IP e por loja. Bloqueio progressivo no login.
- Proteção contra enumeração: respostas iguais para "usuário não existe" e "senha errada"; IDs de pedido públicos não sequenciais (UUID) e com token de acompanhamento.
- Headers de segurança: CSP restritiva, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors`. CORS fechado ao próprio domínio.
- Upload (fotos): validar tipo e tamanho no servidor, reprocessar imagem, bucket com política por loja, nomes aleatórios.
- Erros ao usuário sem detalhes internos; detalhes só em log.

### 11.2 Conexões e segredos
- **Somente HTTPS**; redirecionar HTTP e ativar HSTS. Domínio próprio com certificado automático da Vercel.
- Servidor usa o **pooler de conexões** do Supabase; timeouts e limite de conexões definidos; nenhuma conexão direta ao Postgres pelo navegador.
- Segredos só nas variáveis da Vercel, separados por ambiente (Production, Preview, Development). **Chaves de produção nunca em Preview.**
- Rotação de chaves documentada (`docs/seguranca.md`) e feita em caso de suspeita de vazamento.
- Chamadas a serviços externos (Mercado Pago, WhatsApp, Claude) com **timeout, retry com backoff e circuito de proteção**; falha externa nunca derruba o pedido já gravado.
- **Webhooks:** validar assinatura de cada origem (Mercado Pago: assinatura `x-signature`; WhatsApp/Meta: `X-Hub-Signature-256`), usar corpo bruto para o cálculo, comparação em tempo constante, rejeitar mensagens antigas e **deduplicar por ID do evento** (tabela `eventos_webhook` com chave única).
- Rotas de cron (Vercel Cron) protegidas por segredo próprio.

### 11.3 Repositório e cadeia de suprimentos (GitHub)
- Ativar: secret scanning com **push protection**, Dependabot, CodeQL, branch protection em `main` (PR + CI verde obrigatórios) e 2FA para todos.
- `npm audit` e verificação de licenças no CI; lockfile versionado.
- Rodar os **advisors de segurança do Supabase** no pipeline (tabela sem RLS, função insegura, etc.) e **falhar o CI** se houver alerta crítico.
- Testes automáticos de isolamento: usuário da loja A não lê nem altera nada da loja B; cliente anônimo só lê o cardápio público.

## 12. Pagamentos no back end (Mercado Pago)

### 12.1 Modelo de dinheiro
- O dinheiro do pedido vai para a **conta do lojista**: cada loja conecta a **própria conta Mercado Pago** por OAuth. O Sirvaí **não recebe nem repassa** o valor dos pedidos (coerente com "sem comissão").
- Tokens de cada loja **criptografados em repouso** (Supabase Vault ou criptografia de coluna), com acesso apenas pelo servidor; nunca em log.
- A mensalidade do Sirvaí é outro fluxo (conta da plataforma), separado do dinheiro dos pedidos.

### 12.2 Fluxo seguro do Pix
1. Cliente finaliza o pedido → o servidor recalcula o total e grava o pedido como `aguardando_pagamento`.
2. O servidor cria o pagamento no Mercado Pago com **chave de idempotência** (uma por pedido) e **valor vindo do banco**.
3. Guarda `provedor_ref`, copia e cola e expiração; devolve só o necessário ao cliente.
4. O **webhook não é fonte de verdade**: ao recebê-lo, o servidor valida a assinatura, **consulta o pagamento na API do Mercado Pago** e confere: status aprovado, **valor igual ao do pedido**, referência igual, moeda e conta da loja corretas.
5. Só então marca `pago = true` (transação única, idempotente) e libera o pedido para a cozinha.
6. **Tarefa de conciliação** (Vercel Cron, a cada poucos minutos): reconsulta pagamentos pendentes e expira os vencidos, cobrindo webhook perdido.
7. Estornos e cancelamentos só pelo servidor, com papel autorizado, motivo e registro em auditoria.

### 12.3 Regras
- Valores sempre em **centavos inteiros**; nunca float.
- Máquina de estados do pagamento (`pendente → aprovado | recusado | expirado | estornado`); transições inválidas são rejeitadas.
- **Nunca** tocar em dados de cartão: usar somente fluxos hospedados/tokenizados do provedor, para ficar no menor escopo de conformidade (PCI). Pix é o padrão inicial; cartão e carteiras digitais entram depois pelo mesmo adapter.
- Cashback: crédito só **depois** do pagamento confirmado, e débito em transação com trava (sem saldo negativo, sem uso duplo).
- Cupom: consumo atômico (incrementar uso com condição no banco) para evitar uso além do limite em pedidos simultâneos.
- Tabela `auditoria` (quem, o quê, quando, IP) para ações sensíveis: alterar plano, estornar, mudar chaves, exportar ou apagar dados.
- Logs de pagamento **sem** dados pessoais completos.

## 13. LGPD (privacidade e proteção de dados)

> Estas são diretrizes técnicas. **Antes do lançamento, revisar com advogado de proteção de dados** (termos, política de privacidade, contrato com as lojas e base legal).

### 13.1 Papéis
- **Lojista = controlador** dos dados dos clientes finais dele. **Sirvaí = operador** desses dados (segue as instruções da loja). Para os dados do próprio lojista (cadastro, cobrança), o Sirvaí é controlador.
- Contrato de tratamento de dados (DPA) aceito no cadastro da loja. Indicar um **encarregado (DPO)** e publicar o canal de contato.

### 13.2 Minimização e base legal
- Coletar só o necessário: **nome, telefone e endereço** (quando entrega). Sem CPF, sem data de nascimento, a menos que haja necessidade real.
- Base legal registrada por finalidade: execução do pedido (contrato); **marketing e WhatsApp promocional só com consentimento específico**, opt-in separado, desmarcado por padrão, com fácil descadastro.
- Aviso de privacidade curto no checkout, com link para a política completa. Banner de cookies com consentimento para **Pixel/Analytics** (só carrega após aceitar).

### 13.3 Direitos do titular (automatizar)
- Painel e API para **acessar, corrigir, exportar (JSON/CSV), anonimizar e apagar** os dados de um cliente, com prazo e registro de atendimento.
- A exclusão anonimiza pedidos que precisam ser mantidos para obrigação legal ou fiscal e remove nome, telefone e endereço.
- Revogação de consentimento reflete imediatamente nas campanhas.

### 13.4 Retenção (configurável, como no Gravei)
- Tabela `politica_retencao` por tipo de dado, com tarefa agendada que anonimiza ou apaga ao vencer. Valores iniciais sugeridos (a validar com o advogado):
  - conversas de WhatsApp e mensagens: 90 dias;
  - logs técnicos: 30 a 90 dias, **sem dados pessoais**;
  - clientes inativos: anonimizar após período definido pela loja;
  - pedidos e registros fiscais/financeiros: prazo legal aplicável.

### 13.5 Proteção técnica dos dados pessoais
- Criptografia em trânsito (TLS) e em repouso (padrão do Supabase); campos muito sensíveis (tokens) com criptografia adicional.
- **Isolamento por loja via RLS**, sem exceção; consultas administrativas pelo suporte somente com registro em auditoria.
- Nunca colocar telefone ou endereço em URL, log, mensagem de erro ou ferramenta de monitoramento (usar mascaramento).
- Backups com criptografia e acesso restrito; testar restauração.
- **IA (Claude API) e WhatsApp:** enviar à IA só o necessário (sem endereço completo e sem telefone quando dispensável, usando mascaramento); revisar termos de retenção do provedor e registrar na política de privacidade.
- **Transferência internacional:** Supabase, Vercel, Meta e Anthropic podem processar dados fora do Brasil; escolher a região São Paulo quando existir, e descrever isso na política e no contrato.

### 13.6 Incidentes
- Plano de resposta em `docs/incidentes.md`: detectar, conter, avaliar risco, **comunicar a ANPD e os titulares dentro do prazo regulamentado** (confirmar o prazo vigente com o advogado), registrar e corrigir.
- Alertas de comportamento suspeito: muitos logins falhos, exportações em massa, picos de erro 401/403.

## 14. Nome e domínios: Sirvaí (verificado em 12/10/2026)

**Nome escolhido:** **Sirvaí** (de "sirva aí"), com o módulo do salão chamado **App Garçom**.

**Domínios** (consulta de registro pela Vercel):

| Situação | Domínios |
|---|---|
| **Disponíveis** | **sirvai.com.br**, **sirvai.app**, **sirvai.menu**, sirvai.food, sirvai.dev, sirvai.io, sirvai.site, sirvai.tech, sirvai.store, sirvai.shop, sirvai.delivery, sirvai.online, sirvai.net |
| **Indisponível** | sirvai.com |

**Uso sugerido:**
- `sirvai.com.br`: site institucional e página de vendas.
- `sirvai.app`: painel do lojista e app do garçom.
- `sirvai.menu`: link público do cardápio de cada loja (`sirvai.menu/{slug}`).
- Registrar também `sirvai.food` e `sirvai.delivery` para proteger o nome.
- Conferir o `.com.br` também no **registro.br** (a consulta da Vercel pode não ser definitiva para essa extensão).

**Ainda falta (não foi possível verificar):**
- **Marca no INPI:** buscar "Sirvaí" e variações (Sirvai, Sirvá aí) nas classes **42** (software/SaaS), **35** (gestão e publicidade) e **43** (restaurantes). Depois, protocolar o pedido.
- Busca no Google, Play Store, App Store, Instagram, TikTok e LinkedIn por perfis com o mesmo nome. Uma busca na web por "Sirvaí" no ramo de delivery não encontrou marca conhecida, mas isso não substitui a busca do INPI.

## 15. Primeira instrução para o Claude Code

> Leia este arquivo por completo, **incluindo as Seções 10 a 14 (parâmetros do Gravei, segurança, pagamentos, LGPD e nome)**, que valem para todas as fases. Confirme em 5 linhas o que entendeu e quais dúvidas críticas tem (no máximo 3). Depois execute a **Fase 0** e pare para eu validar.
