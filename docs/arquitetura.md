# Arquitetura

Next.js (App Router) + Supabase (Postgres/RLS/Auth/Realtime/Storage) na Vercel.
Regras de negócio no servidor; navegador nunca é confiável. Veja `CLAUDE.md` para o escopo completo.

## Autenticação e multi-loja (Fase 1)

- Supabase Auth (e-mail + senha, mín. 10 caracteres). `src/proxy.ts` renova a sessão e protege `/painel`.
- `criar_loja()` cria loja, papel `dono`, config, regras de cashback e assinatura de teste.
- Loja ativa em cookie `loja_ativa` (httpOnly), validado contra `membros_loja` a cada troca.
- RLS em todas as tabelas; leitura pública apenas do cardápio ativo e colunas públicas de `lojas`.

## Painel do lojista (Fase 2)

- Server Actions em `src/app/painel/**/acoes.ts`: validam com Zod, exigem papel dono/gerente (`contextoEscrita`) e filtram sempre por `loja_id` da sessão; a RLS repete a checagem no banco.
- Fotos no bucket `produtos` (público para leitura; escrita só na pasta da própria loja).
- Importação CSV em `src/lib/importacao-cardapio.ts` (parser em `src/lib/csv.ts`).
