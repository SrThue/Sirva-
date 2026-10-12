# sirvaí

Plataforma de delivery e salão para restaurantes: cardápio digital, atendente virtual com IA no
WhatsApp, gestão de pedidos em tempo real, Pix e marketing — **sem comissão por pedido**.

Escopo completo, fases e regras de segurança/LGPD: [`CLAUDE.md`](./CLAUDE.md).
Decisões: [`docs/decisoes.md`](./docs/decisoes.md).

## Stack

Next.js (App Router) · TypeScript · Tailwind · shadcn/ui · Supabase · Vercel · Zod · Vitest · Playwright

## Rodando localmente

```bash
cp .env.example .env.local   # preencha os valores (nunca versione o .env.local)
npm install
npm run dev                  # http://localhost:3000
```

## Scripts

| Comando                                   | O que faz                    |
| ----------------------------------------- | ---------------------------- |
| `npm run lint`                            | ESLint                       |
| `npm run format:check` / `npm run format` | Prettier                     |
| `npm run typecheck`                       | TypeScript                   |
| `npm test`                                | Testes de unidade (Vitest)   |
| `npm run test:e2e`                        | Testes de fluxo (Playwright) |
| `npm run build`                           | Build de produção            |

## Banco (Supabase)

Mudanças somente por migrations em `supabase/migrations`. Projeto Supabase exclusivo do Sirvaí
(região São Paulo), separado para desenvolvimento e produção.

## Deploy

Vercel, com deploy de preview por Pull Request. Segredos apenas nas variáveis da Vercel.
