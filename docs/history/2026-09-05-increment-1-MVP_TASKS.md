# Quadro de execução — revisão 1.1

Atualizado em 05/09/2026. Histórico TSK-001–027 preservado integralmente em [quadro anterior](history/2026-09-05-before-review-MVP_TASKS.md). “Concluída” histórico não significa homologado. Nenhuma homologação comprovada nesta revisão.

Cada linha separa implementação, teste e homologação. Responsável é o dono da entrega na equipe; não afirma que a pessoa já executou a mudança. Correções deste incremento foram feitas nesta tarefa.

| ID / prioridade / requisito | Responsável | Dependências | Implementação | Teste / homologação | Evidência | Próximo passo / bloqueio |
|---|---|---|---|---|---|---|
| REV-01 P0 diagnóstico/PRD | Brian | Nenhuma | Implementado | Revisão documental / pendente cliente | PRD raiz; GAP_REVIEW_2026-09-05; history | Confirmar ambiguidades do vídeo e marca |
| SEC-01 P0 sessão gerencial | Fábio | REV-01 | Implementado | Testado localmente / pendente | server-auth.ts; middleware; access-control.test.ts | Sessão real expirada/revogada e iframe em homologação |
| SEC-02 P0 escopo gerencial | Fábio | SEC-01 | Implementado no backend web | Testado localmente / pendente banco | summary filtra organização/filiais; audit exige todas as unidades | Duas organizações isoladas; atribuir auditoria à filial |
| SEC-03 P0 demais APIs/sessão | Fábio | SEC-01 | A fazer | Pendente / pendente | sales/chat/claim/suggestions e defaults login/me | Guard em cada handler, autoria servidor, CSRF/origem e renovação/logout |
| SEC-04 P0 RLS/grants | Fábio | REV-01 | A fazer | Pendente / pendente | migrations/20260903000002 | Banco isolado; corrigir policies/grants/funções e testes negativos diretos |
| INT-01 P0 proteção integrações | Vitor | REV-01 | A fazer | Pendente / pendente | server.ts: CORS aberto, sem auth, logs de conteúdo | Identificar versão Chatwoot; segredo/assinatura, replay, rede/limites e logs mínimos |
| SAL-01 P0 venda transacional | Vitor | SEC-03/04 | A fazer | Pendente / pendente | api/sales: escritas separadas e 201 fallback | Transação/idempotência/centavos; testar falha por escrita, rollback/repetição |
| DEM-01 P0 gerência sem ficção | Fábio | SEC-01 | Implementado | Testado localmente / visual pendente | summary/audit/dashboard; null para indisponíveis | Validar viewport e estados no navegador; nomes reais |
| DEM-02 P0 demais fallbacks | Fábio, apoio Vitor | REV-01 | A fazer | Pendente / pendente | vendas/chat/widget/health/extraction/layout | Remover sucesso fictício; demo explícita em dados isolados |
| CON-01 P1 contatos | Vitor | SEC-03/04, INT-01 | A fazer | Pendente / pendente | webhook organização fixa e customer_channels | Mapear conta/inbox/unidade; identidade externa; sem telefone/homônimos; tela Chatwoot |
| COM-01 P1 encerramento | Vitor | SAL-01, CON-01 | A fazer | Pendente / pendente | RF-02 e CreateSaleInput | Venda sem itens, desfecho/motivo, origem manual, auditoria/reabertura/reconciliação |
| COM-02 P1 tela comercial | Fábio | Contrato COM-01 | A fazer | Pendente / pendente | Widget existente | Reaproveitar painel; Brian valida termos; testar erro/retry e venda total |
| EVT-01 P1 eventos/tempos | Vitor | INT-01, CON-01 | A fazer | Pendente / pendente | RF-04/06 | Eventos humanos/transferência/reabertura; origem desconhecida sem evidência |
| KPI-01 P1 relatórios reais | Fábio | COM-01, EVT-01 | Parcial: filtros/vendas | Regressão parcial / pendente | summary; count exact recusa truncamento | Agregação/paginação, nomes reais, motivos/conversão e conciliação |
| BOT-01 P0/P1 bot durável | Vitor | INT-01, SEC-04 | A fazer | Pendente / pendente | idempotency/agentbot/extraction | Preços sintéticos só demo; estado/replay; corrida bot/humano/reinício |
| CHAT-01 P1 equipe | Fábio | SEC-03/04 | A fazer | Pendente / pendente | chat/messages e salas fixas | Vínculos/autoria/erro/retry; polling provisório documentado |
| UX-01 P1 identidade/operação | Fábio | REV-01; COM-02 para fluxo final | A fazer | Pendente / pendente | Tokens existentes e PRD seção 7 | Marca autorizada; provisória até Brian enviar; teclado/zoom/iframe/1366×768 |
| HOM-01 P1 canais | Brian, apoio Vitor | SEC-03/04, INT-01, BOT-01 | A fazer | Pendente / pendente | RF-01/06 | Duas contas/canais de teste: texto/áudio/nota/transferência/histórico/reconexão |
| OPS-01 P0 liberação | Vitor | SEC-04, INT-01 | A fazer | Pendente / pendente | Dockerfile/runbooks | Backup/restauração/reinício/rede/segredos em ambiente isolado; produção exige autorização |
| DEMO-01 demonstração | Brian | P0 resolvidos, COM-02, KPI-01, CHAT-01, UX-01 | A fazer | Pendente / pendente | MVP_7_DAY_PLAN | Fluxo sintético identificado e limitações explícitas; não equivale a produção |

## Registro de incrementos

05/09 — Incremento 1: autorização/escopo gerenciais, fim de fallback gerencial, filtros backend e estados indisponíveis; cookies de login HttpOnly. 17 testes HTTP locais simulados aprovados e typecheck aprovado. Banco/canais/UI executada não homologados. Auditoria legada nega gerente sem todas as unidades. Nenhum deploy/migração.

Próximo: SEC-03 e INT-01 independentes; SAL-01 depende da autorização, schema e ambiente isolado. Contratos e produto podem avançar; integração final P1 depende dos P0. Não declarar segurança global com base no primeiro incremento.
