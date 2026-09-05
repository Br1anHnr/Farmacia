# Incremento 2 — P0, 05/09/2026

Escopo: continuação das tarefas SEC-03/04, INT-01 e SAL-01, sem reconstruir mensageria. Migração criada pela CLI 2.116.0 e aplicada apenas em PostgreSQL descartável local (PGlite 0.5.8). Nenhum Supabase remoto foi alterado; nenhum deploy ou migração de dados/canais foi executado.

## Mudanças

- API: login/me/logout, vendas, chat, claim, sugestões, catálogo e gerência validam identidade/permissão. Login e me removem defaults. POST por cookie rejeita origem ausente/cruzada. O helper REST exige JWT individual. Claim obtém ID Chatwoot do mapeamento de usuário no banco; falha de sincronização retorna erro, não sucesso.
- Banco: grants explícitos; policies com organização, filial, autoria e vínculo de sala; admin técnico sem relatórios comerciais; SQL privilegiado em schema privado com search_path fixo e EXECUTE restrito. Referências compostas impedem novas linhas misturando organizações. Auditoria sem filial do legado só é legível por gerente vinculado a todas as unidades.
- Venda: RPC transacional/idempotente com lock da conversa e da chave. Cliente eventual, venda, itens, auditoria e resposta são atômicos; valores são numeric com arredondamento por item. Desconto excessivo/subcentavo, produto estrangeiro e conversa não autorizada falham. Falhas nos itens ou auditoria revertem tudo. Chave de retry preservada no painel, inclusive após recarregar a mesma aba.
- Webhook: HMAC-SHA256 sobre timestamp + ponto + corpo bruto; cinco minutos de tolerância; limite de 256 KiB; conta/inbox explícitos; chave estável por evento. Os dois endpoints deduplicam a mesma mensagem. Reserva concluída sobrevive ao reinício do PostgreSQL. Reserva em processamento/incerta nunca dispara de novo por timeout automático.
- Contato sincronizado usa organização + conta + ID externo, não nome; deduplicação é parte necessária da persistência do webhook. Não foi criada tela de contatos.
- Serviço de integração deixou de expor implementações duplicadas e inseguras de claim/sugestões; UI usa handlers autenticados do Next. Health exige segredo e relata somente processo, sem inventar canais conectados.
- Painel: catálogo autorizado substitui preços fixos; contexto de iframe exige origem/fonte configuradas; venda exige contexto validado e não inventa ID de sucesso. Não foi feita reformulação visual.

## Executar testes locais

- `npm test`: suíte existente e novos testes. vitest.config.ts não carrega .env; tests/setup.ts configura apenas endereços .invalid e bloqueia fetch não simulado.
- `npm run typecheck`: todos os workspaces.
- `npx vitest run tests/p0-database.test.ts tests/p0-durability.test.ts`: policies/grants, integridade, transação, idempotência e reabertura do banco local.
- `npx vitest run apps/integration-service/src/__tests__/webhook-security.test.ts`: HTTP loopback real; persistência/serviços remotos simulados.
- `supabase/tests/rls_test.sql` também é executado na suíte. Seu aceite anônimo agora admite bloqueio por grant, mais restritivo que retorno vazio.

Resultado final: **121/121 testes em 10 arquivos; TypeScript aprovado nos quatro workspaces**. São 43 casos no SQL PostgreSQL, 1 teste de reabertura persistida, 18 testes HTTP de webhook e os testes de APIs/fluxos existentes. Resultados também registrados no quadro MVP_TASKS.md. Testes não fazem requisições GoTrue/PostgREST/Chatwoot reais. O PostgreSQL WASM exercita SQL/RLS/transações, mas não substitui a versão/extensões/configuração do Supabase hospedado. pgcrypto do schema inicial é omitido no harness; gen_random_uuid do PostgreSQL é usado. PGlite possui conexão serializada: teste Promise.all não comprova contenção entre processos PostgreSQL nativos.

## Configuração e gates ainda pendentes

1. HOM-P0: ambiente Supabase/Chatwoot isolado identificado, com duas organizações/unidades/usuários; testar JWT real, RPC via PostgREST, grants, corrida entre processos, timeout após commit, associação native Chatwoot/Hub e canais. O SQL novo não está instalado remotamente; o código falha explicitamente se a RPC/configuração estiver ausente.
2. SEC-05: revogar/rotacionar a credencial Chatwoot anteriormente embutida em rotas versionadas. Foi removida do código, mas isso não a revoga nem remove o histórico. Não executar rotação em produção sem autorização.
3. INT-02: verificar versão/edição e configurar emissor de assinatura ou ingress privado autenticado. Não há alegação de que Chatwoot assine nativamente esse protocolo. Nunca criar gateway público que assine requisições arbitrárias. Definir CHATWOOT_WEBHOOK_SECRET aleatório (mínimo 32 caracteres), HUB_INTERNAL_TOKEN distinto e mapeamento CHATWOOT_INBOX_MAP validado contra branches.
4. Preencher chatwoot_agents por usuário/organização/conta apenas em ambiente autorizado. Conversas legadas sem conta/mapeamento não ganham defaults. Sync de inbox diferente é conflito; transferência deve ser reconciliada no processo de homologação.
5. Legado: inspecionar referências antes de VALIDATE CONSTRAINT em ambiente autorizado; não migramos dados. Backup/restauração nativo permanece OPS-01.
6. Eventos uncertain/processing e bot_event_key pendente: verificar efeitos no Chatwoot e auditoria antes de qualquer liberação manual. Não apagar recibos para forçar retry. A reserva evita duplicação, mas um resultado incerto pode exigir intervenção; não promete exactly-once entre banco e API externa.
7. Conta do Hub expira conforme access token (máximo uma hora no cookie). Não há refresh automático/SSO nesta etapa. SameSite=Lax e origem exata são mantidos; iframe entre sites precisa da avaliação UNI-01, não de relaxamento de segurança.

## Arquivos deste incremento

- Autorização/transporte: apps/web/src/lib/server-auth.ts, supabase.ts, conversation-access.ts; apps/web/next.config.mjs.
- Handlers: apps/web/src/app/api/auth/{login,me,logout}/route.ts; api/sales/route.ts; api/chat/messages/route.ts; api/conversations/[id]/{claim,suggestions}/route.ts; api/products/route.ts; api/{dashboard/summary,audit}/route.ts.
- Compatibilidade/estados de persistência: apps/web/src/app/chatwoot-widget/page.tsx; apps/web/src/app/(shared)/chat/page.tsx (sem mensagem otimista em falha); apps/web/src/app/(manager)/layout.tsx (sem ONLINE fixo).
- Integrações: apps/integration-service/src/{server,config}.ts; services/{agentbot,webhook-security}.ts.
- SQL: supabase/migrations/20260905165519_harden_p0_access_and_transactions.sql e supabase/tests/rls_test.sql. Migrações anteriores intactas.
- Testes: tests/{setup,p0-database.test,p0-durability.test}.ts; tests/support/{database,http}.ts; apps/web/src/__tests__/{auth,sales-calculation,api-security}.test.ts; apps/integration-service/src/__tests__/webhook-security.test.ts; vitest.config.ts e vitest.security.config.ts.
- Dependências/configuração: package.json, package-lock.json (PGlite de teste fixado em 0.5.8), .env.example, .gitignore.
- Documentos: PRD raiz; docs/MVP_TASKS.md, MVP_STATUS.md, MVP_7_DAY_PLAN.md, GAP_REVIEW_2026-09-05.md e este relatório. Ajustes de formatação atingiram também arquivos de código já modificados no incremento anterior, sem nova funcionalidade.

## Fontes técnicas verificadas

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) e [funções](https://supabase.com/docs/guides/database/functions): JWT do usuário, grants explícitos e funções privilegiadas restritas.
- [Changelog Supabase](https://supabase.com/changelog): revisão de mudanças relevantes; não dependemos de exposição automática de novas tabelas.
- [PGlite](https://pglite.dev/docs/): PostgreSQL local descartável e limites da conexão única.
- [Webhooks Chatwoot](https://developers.chatwoot.com/api-reference/webhooks/add-a-webhook): a configuração instalada e autenticação do emissor continuam a homologar.

Verificação final adicional: o receptor recusa MOCK_MODE fora de NODE_ENV=test; sugestões sintéticas não são disponibilizadas em NODE_ENV=production. Esta proteção adicionou o teste 121.
