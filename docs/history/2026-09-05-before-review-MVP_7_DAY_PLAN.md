# Cronograma Adaptativo de 7 Dias — MVP Hub Farmácia

> **Diretriz de Fluxo Contínuo:** Os dias indicados representam marcos máximos de entrega, não travas temporais. Sempre que uma tarefa tiver suas dependências concluídas, ela deve ser executada e validada imediatamente, permitindo a antecipação de entregas de dias posteriores.

---

## 1. Visão Geral e Responsabilidades

* **Brian — Gestão do projeto e produto:** cronograma, escopo, critérios de aceite, alinhamento, validação funcional e demo.
* **Fábio — Segurança, dashboard e interface:** UI do hub (Next.js), Supabase Auth, RLS rigoroso (Manager vs Agent), Dashboard App lateral do Chatwoot, confirmação de venda e auditoria.
* **Vitor — Backend, infraestrutura e integrações:** serviço de integração, Chatwoot, Evolution API, webhooks com idempotência, AgentBot e handoff atômico, adaptadores e health checks.

---

## 2. Cronograma de Entregas por Dia

### Dia 1 — Fundação, Arquitetura e Contratos
* **Entregas:**
  - Repositório monorepo configurado com tipagem estrita e scripts de build/teste.
  - Documentação de governança (`docs/MVP_7_DAY_PLAN.md`, `docs/MVP_STATUS.md`, `docs/MVP_TASKS.md`, ADRs e runbooks).
  - Schemas Zod e tipos estritos compartilhados em `packages/contracts` para webhooks, AgentBot, vendas, eventos e auditoria.
  - Estrutura base de banco no Supabase (`supabase/migrations`) com as 16 tabelas canônicas.
* **Responsáveis:**
  - Brian: Revisão de escopo e aprovação dos contratos.
  - Fábio: Modelagem de autenticação, perfis e RLS inicial.
  - Vitor: Monorepo, contratos Zod e schema inicial do banco.
* **Caminho Crítico:** Definição dos contratos Zod e schema das tabelas de organização, vendas e eventos.
* **Critério de Aceite:** `npm.cmd run typecheck` e migrações SQL sem erros de sintaxe.

### Dia 2 — Segurança, RLS e Isolamento de Perfis
* **Entregas:**
  - Políticas RLS completas e granulares para todas as tabelas.
  - Proteção estrita: papel `manager` acessa dados agregados e auditoria; papel `agent` tem acesso bloqueado ao dashboard executivo e vê apenas sua operação.
  - Funções auxiliares `auth.user_has_role(org_id, role)`.
  - Suíte de testes automatizados de RLS (incluindo testes negativos de permissão negada).
* **Responsáveis:**
  - Fábio: RLS policies, testes de segurança e matriz de autorização.
  - Vitor: Seed com dados sintéticos e suporte na infraestrutura de testes.
  - Brian: Validação dos cenários de autorização.
* **Caminho Crítico:** Garantir que o atendente receba 403 / 0 linhas em dados agregados.
* **Critério de Aceite:** Testes de banco aprovados comprovando bloqueio de atendente em relatórios gerenciais.

### Dia 3 — Integração Chatwoot, Evolution e Idempotência
* **Entregas:**
  - Serviço de integração Node.js/TypeScript (`apps/integration-service`) com endpoints `/internal/chatwoot/webhook` e `/internal/health`.
  - Mecanismo de idempotência com chave única e controle de duplicatas via tabela `integration_events`.
  - Adaptadores desacoplados para Chatwoot e Evolution API (com suporte a execução real e modo de emulação para testes).
  - Runbook de reconexão do WhatsApp.
* **Responsáveis:**
  - Vitor: Serviço de integração, adaptadores, idempotência e runbooks.
  - Brian: Validação dos fluxos de webhook e dados de homologação.
  - Fábio: Validação dos payloads com os contratos da UI.
* **Caminho Crítico:** Idempotência e confiabilidade no processamento de mensagens.
* **Critério de Aceite:** Envio duplo de webhook com mesmo payload ID resulta em apenas um processamento.

### Dia 4 — AgentBot, Triagem e Handoff Atômico
* **Entregas:**
  - Endpoint `/internal/chatwoot/agent-bot` para triagem e reconhecimento de intenções (`comprar produto`, `enviar receita`, `consultar pedido`, `tirar dúvida`, `falar com atendente`).
  - Máquina de estados da conversa: desligamento atômico do bot assim que um humano assume ou envia mensagem.
  - Regra de receita médica: confirmação cordial de recebimento sem interpretação clínica e transferência imediata para o atendente.
  - Fallback resiliente: falha do bot nunca bloqueia a conversa humana.
* **Responsáveis:**
  - Vitor: Máquina de estados do AgentBot, triagem e handoff atômico.
  - Brian: Validação dos roteiros de triagem e fallback humano.
  - Fábio: Alinhamento das informações de intenção para exibição no painel lateral.
* **Caminho Crítico:** Desligamento atômico do bot prevenindo respostas simultâneas.
* **Critério de Aceite:** Teste automatizado e manual comprovando que bot nunca responde após intervenção do atendente.

### Dia 5 — Dashboard App Lateral e Confirmação de Venda
* **Entregas:**
  - Dashboard App incorporada ao Chatwoot (`/chatwoot-widget`) via iframe com validação rigorosa de `postMessage` e autenticação própria no Supabase.
  - Exibição de contexto do cliente, intenção detectada e sugestões de itens extraídos de texto.
  - Formulário operacional de confirmação de venda com seleção de catálogo, quantidades, método (entrega/retirada) e botão de confirmação humana.
  - Gravação estruturada em `sales` e `sale_items` e registro do evento em `audit_events`.
* **Responsáveis:**
  - Fábio: Frontend do widget, formulário de venda e integração com Supabase.
  - Vitor: Serviço silencioso de extração comercial e emissão de sugestões.
  - Brian: Teste de usabilidade do fluxo do atendente.
* **Caminho Crítico:** Venda registrada somente sob ação deliberada do atendente.
* **Critério de Aceite:** Venda confirmada é gravada com `status: 'confirmed'`, associada à conversa e ao atendente.

### Dia 6 — Dashboard Gerencial, Auditoria e Chat Interno
* **Entregas:**
  - Dashboard gerencial (`/dashboard`) com layout moderno, protegido em nível de rota e de API para papel `manager`.
  - Cards de KPIs (Faturamento, Conversão, Ticket Médio, Vendas por Canal) e gráficos/rankings de produtos e atendentes.
  - Filtros dinâmicos por período, canal, unidade e atendente.
  - Trilha de auditoria operacional (`/audit`) exibindo eventos críticos imutáveis.
  - Chat interno da equipe (`/chat`) com Supabase Realtime (Sala Geral e Salas por Unidade).
* **Responsáveis:**
  - Fábio: Dashboard gerencial, gráficos, filtros, auditoria e chat interno.
  - Vitor: Otimização de queries e eventos Realtime.
  - Brian: Validação de relatórios e cenários de gerência.
* **Caminho Crítico:** Isolamento estrito de acesso e precisão matemática dos indicadores.
* **Critério de Aceite:** Gerente visualiza dados agregados; atendente ao tentar acessar é barrado com 403.

### Dia 7 — Hardening, Suíte Ponta a Ponta e Roteiro de Demonstração
* **Entregas:**
  - Suíte completa de testes automatizados (unitários, integração e simulação ponta a ponta).
  - Verificação de segurança: auditoria de secrets, verificação de pacotes e sanitização de logs.
  - Preparação do ambiente de demonstração com catálogo sintético e dados de teste.
  - Documentação final de homologação, runbooks e ensaio completo do roteiro da demo.
* **Responsáveis:**
  - Brian: Condução do ensaio da demo e roteiro de validação.
  - Fábio: Revisão de segurança, RLS e responsividade visual.
  - Vitor: Teste de carga básico, validação de health checks e logs estruturados.
* **Critério de Aceite:** Todos os 11 itens mínimos do PRD validados e aprovados.

---

## 3. Matriz de Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| **Queda de sessão na Evolution API** | Média | Alto | Número de homologação dedicado, monitoramento de status da instância e runbook de reconexão ágil. |
| **Resposta duplicada Bot + Humano** | Média | Alto | Máquina de estados atômica persistida no banco; trava imediata no primeiro evento humano. |
| **Atendente acessar dados sigilosos/gerenciais** | Baixa | Crítico | Validação em três camadas: RLS no Postgres, middleware no Next.js e verificação de claims nas APIs. |
| **Falha do provedor de IA travar atendimento** | Média | Alto | Fallback gracioso: timeout curto no AgentBot repassa a conversa para a fila humana imediatamente. |
| **Inconsistência em valores de vendas** | Baixa | Alto | Uso exclusivo de tipo `numeric(12,2)` em banco e operações com precisão decimal, proibindo float. |
