# Estado atual — 05/09/2026

Base avançada, revisão incremental em curso. **Não homologado e não liberado para produção.** A afirmação anterior de 100% está preservada em history/2026-09-05-before-review-MVP_STATUS.md e foi substituída por evidências por tarefa.

Primeiro incremento: autorização gerencial por sessão/vínculos no servidor; escopo organização/unidades; fim dos fallbacks gerenciais; filtros backend; dados indisponíveis explícitos; cookies login HttpOnly. 17 testes HTTP simulados e typecheck aprovados. Sem banco/canais reais, deploy ou migração. UI visual ainda não homologada.

P0 abertos: demais APIs e defaults login/me, RLS/grants, integrações expostas, venda transacional/idempotente, chat/bot/demo e infraestrutura. A etapa não prova segurança global.

Brian valida vídeo/marca/motivos e organiza homologação. Fábio segue SEC-03/04 e DEM-02. Vitor segue INT-01, ambiente isolado e SAL-01. Quadro: MVP_TASKS.md. Janela: MVP_7_DAY_PLAN.md. Diagnóstico: GAP_REVIEW_2026-09-05.md. ERP fora do incremento.

## Atualização — incremento 2

P0 implementados e testados no código local: APIs autenticadas/escopadas; RLS/grants revisados; venda RPC atômica/idempotente; webhook assinado com recibo durável. Resultado final: 121 testes em 10 arquivos e typecheck aprovados. Testes SQL usam PostgreSQL WASM; HTTP externo é simulado.

A lista de P0 abertos acima é o histórico do incremento 1. Gates atuais: HOM-P0 (Supabase/Chatwoot isolados), INT-02 (emissor assinado), SEC-05 (rotação da credencial previamente embutida, exige autorização), legado e OPS-01. Não há liberação para produção. UNI-01 criada para avaliação de interface única, navegação/domínio/SSO e upgrades do Chatwoot. Não foi criada nova mensageria nem feita personalização profunda.
