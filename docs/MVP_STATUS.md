# Status de Execução do MVP — Hub Omnichannel para Farmácia

* **Última Atualização:** 03/09/2026
* **Fase Atual:** Fase 6 — Hardening, Verificação e Preparação da Demonstração
* **Percentual Aproximado do MVP:** 85%

---

## 1. Visão por Responsável

### Brian (Gestão e Produto)
* **Atividade Atual:** Validação do roteiro de demonstração operacional (`docs/DEMO_WALKTHROUGH.md`) e preparação do alinhamento com o cliente.
* **Status:** Em andamento.

### Fábio (Segurança, Dashboard e Frontend)
* **Atividade Atual:** Validação das regras de acesso negado (HTTP 403), Dashboard App lateral no Chatwoot (`/chatwoot-widget`) e tela do Dashboard Gerencial (`/dashboard`).
* **Status:** Em andamento.

### Vitor (Backend, Infraestrutura e Integrações)
* **Atividade Atual:** Finalização da instalação de dependências para execução dos testes automatizados de AgentBot, idempotência e simulação ponta a ponta.
* **Status:** Em andamento.

---

## 2. Quadro de Entregas

### Concluído
- [x] Repositório Git inicializado com `.gitignore` e `.env.example`.
- [x] Governança completa: `docs/MVP_7_DAY_PLAN.md`, `docs/MVP_STATUS.md`, `docs/MVP_TASKS.md`.
- [x] ADRs 001 a 006 registrados em `docs/adr/`.
- [x] Runbooks operacionais de reconexão da Evolution e fallback de IA em `docs/runbooks/`.
- [x] Contratos Zod estritos e compartilhados em `packages/contracts/`.
- [x] Pacote de UI e tokens visuais em `packages/ui/`.
- [x] Migrações Supabase com 16 tabelas canônicas e RLS rigoroso em `supabase/migrations/`.
- [x] Base sintética de sementes em `supabase/seed.sql`.
- [x] Serviço de integração com AgentBot, triagem, handoff atômico e idempotência em `apps/integration-service/`.
- [x] Adaptadores desacoplados para Chatwoot e Evolution API.
- [x] Serviço de extração silenciosa de dados comerciais de texto.
- [x] Aplicação Web Next.js com Dashboard Gerencial, Auditoria, Chat Interno e Dashboard App do Chatwoot em `apps/web/`.
- [x] Middleware e endpoint bloqueando estritamente atendentes do dashboard gerencial (HTTP 403).
- [x] Roteiro de demonstração para o cliente em `docs/DEMO_WALKTHROUGH.md`.

### Em Andamento
- [ ] Execução e aprovação da suíte de testes automatizados (`vitest`).

### Bloqueado
* *Nenhum bloqueio técnico no momento.*

---

## 3. Próximo Objetivo Imediato
Concluir a execução dos testes automatizados e registrar os resultados no relatório final de entrega.
