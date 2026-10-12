# Decisões

| Data       | Decisão                                                              | Motivo                                                                           |
| ---------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 2026-10-12 | Repositório `srthue/sirva-` usado como o repositório novo do Sirvaí. | Já estava criado e vazio.                                                        |
| 2026-10-12 | Fontes do sistema (sem `next/font/google`).                          | Build sem depender de rede externa e carregamento mais rápido em celular barato. |
| 2026-10-12 | Playwright roda só localmente na Fase 0; E2E entra no CI na Fase 10. | Evitar CI lento antes de existir fluxo para testar.                              |
| 2026-10-12 | `npm audit` no CI não bloqueia por enquanto.                         | Ruído de dependências transitivas; passa a bloquear na Fase 10.                  |
