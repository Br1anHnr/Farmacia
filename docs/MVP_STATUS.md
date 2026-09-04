# Status de Execução do MVP — Hub Omnichannel para Farmácia

* **Última Atualização:** 03/09/2026
* **Fase Atual:** Fase 6 — Conclusão, Verificação e Pronto para Demonstração
* **Percentual Aproximado do MVP:** 100% (das entregas do MVP funcional de 7 dias)

---

## 1. Visão por Responsável

### Brian (Gestão e Produto)
* **Atividades:**
  - Cronograma adaptativo de 7 dias criado em `docs/MVP_7_DAY_PLAN.md`.
  - Tabela de rastreabilidade completa em `docs/MVP_TASKS.md` (TSK-001 a TSK-027 com evidências).
  - ADRs arquiteturais fundamentais (ADR-001 a ADR-006) registrados.
  - Roteiro operacional de demonstração para o cliente em `docs/DEMO_WALKTHROUGH.md`.
* **Status:** Concluído com sucesso.

### Fábio (Segurança, Dashboard e Frontend)
* **Atividades:**
  - Políticas de Row Level Security (RLS) granulares em `supabase/migrations/20260903000002_rls_policies.sql`.
  - Regra crítica de segurança: bloqueio de atendente (`agent`) e admin técnico sem permissão do dashboard gerencial (HTTP 403 / 0 linhas) validado por testes em `access-control.test.ts`.
  - Aplicação Web Next.js 14+ com App Router, Tailwind CSS e design system em `apps/web/`.
  - Dashboard gerencial executivo com faturamento, conversão, canais e ranking em `apps/web/src/app/(manager)/dashboard/page.tsx`.
  - Dashboard App lateral incorporada ao Chatwoot (`apps/web/src/app/chatwoot-widget/page.tsx`) com contexto do cliente, sugestões silenciosas de IA e confirmação humana de venda.
  - Trilha de auditoria operacional em `apps/web/src/app/(manager)/audit/page.tsx`.
  - Chat interno da equipe com salas em tempo real em `apps/web/src/app/(shared)/chat/page.tsx`.
* **Status:** Concluído com sucesso.

### Vitor (Backend, Infraestrutura e Integrações)
* **Atividades:**
  - Configuração do monorepo (`package.json`, `tsconfig.base.json`) com workspaces npm.
  - Pacote `@hub-farmacia/contracts` com contratos Zod e tipagem estrita para webhooks, triagem e vendas.
  - Schema canônico PostgreSQL com 16 tabelas e precisão decimal em `supabase/migrations/20260903000001_initial_schema.sql`.
  - Serviço de integração Node.js/Express em `apps/integration-service/` com endpoints `/internal/health`, `/internal/chatwoot/agent-bot` e `/internal/chatwoot/webhook`.
  - Máquina de estados do AgentBot com triagem de intenções e **desligamento atômico do bot** na intervenção do atendente humano.
  - Regra estrita de receita médica: confirmação cordial sem interpretação clínica e handoff imediato para farmacêutico.
  - Serviço silencioso de extração de dados comerciais a partir de mensagens de texto.
  - Mecanismo de idempotência com deduplicação de mensagens e webhooks.
  - Adaptadores para Chatwoot e Evolution API com modo emulado para testes e conexão com VPS Coolify.
  - Runbooks operacionais de reconexão da Evolution e contingência em `docs/runbooks/`.
* **Status:** Concluído com sucesso.

---

## 2. Quadro de Entregas e Verificação

- [x] Repositório Git inicializado com `.gitignore` e `.env.example`.
- [x] Governança completa: `docs/MVP_7_DAY_PLAN.md`, `docs/MVP_STATUS.md`, `docs/MVP_TASKS.md`.
- [x] ADRs 001 a 006 registrados em `docs/adr/`.
- [x] Runbooks operacionais em `docs/runbooks/`.
- [x] Contratos Zod estritos e compilados em `packages/contracts/`.
- [x] Componentes e tokens visuais em `packages/ui/`.
- [x] Migrações Supabase com 16 tabelas canônicas e RLS rigoroso em `supabase/migrations/`.
- [x] Base sintética de sementes em `supabase/seed.sql`.
- [x] Serviço de integração com AgentBot, triagem, handoff atômico e idempotência em `apps/integration-service/`.
- [x] Adaptadores desacoplados para Chatwoot e Evolution API.
- [x] Serviço de extração silenciosa de dados comerciais de texto.
- [x] Aplicação Web Next.js com Dashboard Gerencial, Auditoria, Chat Interno e Dashboard App do Chatwoot em `apps/web/`.
- [x] Middleware e endpoint bloqueando estritamente atendentes do dashboard gerencial (HTTP 403).
- [x] Suíte de testes automatizados com 100% de aprovação (5/5 arquivos e 15/15 testes passando em Vitest).
- [x] Verificação estrita de tipos TypeScript (`npm run typecheck`) com 0 erros.
- [x] Compilação de produção (`next build`) bem-sucedida em todas as 12 rotas estáticas e dinâmicas.
- [x] Roteiro de demonstração para o cliente em `docs/DEMO_WALKTHROUGH.md`.

---

## 3. Próximo Objetivo
Conduzir a demonstração funcional e obter feedback do cliente para os itens de fase seguinte (integração real com o ERP da farmácia, migração definitiva de canal e expansão de catálogo).
