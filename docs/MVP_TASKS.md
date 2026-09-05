# Quadro de execução — revisão 1.1

Atualizado em 05/09/2026. Histórico TSK-001–027 preservado integralmente em [quadro anterior](history/2026-09-05-before-review-MVP_TASKS.md). “Concluída” histórico não significa homologado. Nenhuma homologação comprovada nesta revisão.

Cada linha separa implementação, teste e homologação. Responsável é o dono da entrega na equipe; não afirma que a pessoa já executou a mudança. Correções deste incremento foram feitas nesta tarefa.

| ID / prioridade / requisito | Responsável | Dependências | Implementação | Teste / homologação | Evidência | Próximo passo / bloqueio |
|---|---|---|---|---|---|---|
| REV-01 P0 diagnóstico/PRD | Brian | Nenhuma | Implementado | Revisão documental / pendente cliente | PRD raiz; GAP_REVIEW_2026-09-05; history | Confirmar ambiguidades do vídeo e marca |
| SEC-01 P0 sessão gerencial | Fábio | REV-01 | Implementado | Testado localmente / pendente | server-auth.ts; middleware; access-control.test.ts | Sessão real expirada/revogada e iframe em homologação |
| SEC-02 P0 escopo gerencial | Fábio | SEC-01 | Implementado no backend web | Testado localmente / pendente banco | summary filtra organização/filiais; audit exige todas as unidades | Duas organizações isoladas; atribuir auditoria à filial |
| SEC-03 P0 demais APIs/sessão | Fábio | SEC-01 | Implementado | Testado localmente / pendente GoTrue real | handlers API; server-auth; 121 testes totais | HOM-P0: tokens reais/expiração/CSRF/iframe; sem defaults de identidade |
| SEC-04 P0 RLS/grants | Fábio | REV-01 | Implementado em migração local | 43 casos PostgreSQL + roteiro SQL existente / pendente Supabase | 20260905165519_harden_p0_access_and_transactions.sql; p0-database.test.ts | HOM-P0: PostgREST, concorrência nativa e legado; não aplicada remotamente |
| INT-01 P0 proteção integrações | Vitor | REV-01 | Implementado no receptor | 18 testes HTTP e durabilidade PostgreSQL / emissor pendente | webhook-security.ts, server.ts, RPCs privadas | INT-02: configurar e provar assinatura no emissor/ingress autenticado; sem presumir suporte nativo |
| SAL-01 P0 venda transacional | Vitor | SEC-03/04 | Implementado | Testado em PostgreSQL local e HTTP / pendente remoto | record_sale; rollback de itens/auditoria/cliente; chave persistida no painel | HOM-P0: RPC real, timeout pós-commit e concorrência entre processos |
| DEM-01 P0 gerência sem ficção | Fábio | SEC-01 | Implementado | Testado localmente / visual pendente | summary/audit/dashboard; null para indisponíveis | Validar viewport e estados no navegador; nomes reais |
| DEM-02 P0 demais fallbacks | Fábio, apoio Vitor | REV-01 | Corrigidos sucessos/valores fictícios identificados | Tipos/API testados / visual pendente | vendas/chat/widget/health; catálogo autorizado; fim de envio otimista e ONLINE fixo | HOM-P0/UX-01: executar telas; demo continua isolada e identificada |
| CON-01 P1 contatos | Vitor | SEC-03/04, INT-01 | Parcial: identidade externa transacional no webhook | Sem telefone/homônimos testados localmente / pendente canal | sync_webhook e customer_identities privada | Validar contas/inboxes reais, base antiga e consulta Chatwoot; sem tela nova |
| COM-01 P1 encerramento | Vitor | SAL-01, CON-01 | A fazer | Pendente / pendente | RF-02 e CreateSaleInput | Venda sem itens, desfecho/motivo, origem manual, auditoria/reabertura/reconciliação |
| COM-02 P1 tela comercial | Fábio | Contrato COM-01 | A fazer | Pendente / pendente | Widget existente | Reaproveitar painel; Brian valida termos; testar erro/retry e venda total |
| EVT-01 P1 eventos/tempos | Vitor | INT-01, CON-01 | A fazer | Pendente / pendente | RF-04/06 | Eventos humanos/transferência/reabertura; origem desconhecida sem evidência |
| KPI-01 P1 relatórios reais | Fábio | COM-01, EVT-01 | Parcial: filtros/vendas | Regressão parcial / pendente | summary; count exact recusa truncamento | Agregação/paginação, nomes reais, motivos/conversão e conciliação |
| BOT-01 P0/P1 bot durável | Vitor | INT-01, SEC-04 | Parcial: turnos/recibos e handoff persistidos | Falha externa/replay/reabertura testados localmente / pendente corrida real | bot_event_key, reserve_webhook, agentbot reutilizado | HOM-P0: corrida com atendente nativo e reconciliação de estado incerto; não promete exactly-once externo |
| CHAT-01 P1 equipe | Fábio | SEC-03/04 | Parcial: sala/autor protegidos e envio sem falso sucesso | RLS e API testados / visual pendente | chat/messages; policy has_room; UI mantém texto em falha | Salas dinâmicas/nome de colegas e retry idempotente de mensagens em P1; polling preservado |
| UX-01 P1 identidade/operação | Fábio | REV-01; COM-02 para fluxo final | A fazer | Pendente / pendente | Tokens existentes e PRD seção 7 | Marca autorizada; provisória até Brian enviar; teclado/zoom/iframe/1366×768 |
| HOM-01 P1 canais | Brian, apoio Vitor | SEC-03/04, INT-01, BOT-01 | A fazer | Pendente / pendente | RF-01/06 | Duas contas/canais de teste: texto/áudio/nota/transferência/histórico/reconexão |
| OPS-01 P0 liberação | Vitor | SEC-04, INT-01 | A fazer | Pendente / pendente | Dockerfile/runbooks | Backup/restauração/reinício/rede/segredos em ambiente isolado; produção exige autorização |
| DEMO-01 demonstração | Brian | P0 resolvidos, COM-02, KPI-01, CHAT-01, UX-01 | A fazer | Pendente / pendente | MVP_7_DAY_PLAN | Fluxo sintético identificado e limitações explícitas; não equivale a produção |

## Novas tarefas e gates

| ID | Responsável | Dependências | Status / teste / homologação | Evidência | Próximo passo |
|---|---|---|---|---|---|
| HOM-P0 — validação do ambiente | Fábio, apoio Vitor | SEC-03/04, INT-01, SAL-01 testados localmente | A fazer; ambiente isolado a identificar / pendente / pendente | P0_INCREMENT_2.md | Executar JWT/PostgREST/concorrência nativa, reinício/rollback e canais em ambiente autorizado; não usar produção |
| INT-02 — emissor assinado | Vitor | INT-01; versão/edição Chatwoot | A fazer / pendente / pendente | Protocolo HMAC e .env.example | Confirmar assinatura nativa ou ingress privado autenticado; não assinar tráfego público arbitrário |
| SEC-05 — credencial exposta no histórico | Vitor | Autorização para intervenção no ambiente | Pendente de autorização / não executado / pendente | Token fixo removido das rotas; histórico Git permanece | Revogar/rotacionar credencial Chatwoot em janela autorizada; não reproduzir segredo no quadro |
| UNI-01 — avaliar interface única | Fábio; Brian valida produto; Vitor avalia integração | P0 implementados/testados localmente; execução futura depende de HOM-P0 | Avaliação documental desbloqueada, a fazer / não testado / não homologado | PRD RF-09, seção 14 | Produzir ADR comparando personalização mínima do frontend Chatwoot, módulos Hub na mesma navegação/domínio, autenticação unificada e impacto/manutenção em upgrades; estimar esforço/licença/risco e validar com Brian |

UNI-01 não autoriza nova caixa de mensagens, personalização profunda ou deploy. Aceite: proposta concreta com ponto único de entrada no Chatwoot, vendas/contatos/equipe/atalhos no fluxo, gerência na mesma navegação somente para manager; alternativa de autenticação explicitando suporte/limites da edição instalada e plano de atualização/rollback. Não declarar SSO implementado.

## Registro de incrementos

05/09 — Incremento 1: autorização/escopo gerenciais, fim de fallback gerencial, filtros backend e estados indisponíveis; cookies de login HttpOnly. 17 testes HTTP locais simulados aprovados e typecheck aprovado. Banco/canais/UI executada não homologados. Auditoria legada nega gerente sem todas as unidades. Nenhum deploy/migração.

Plano registrado ao fim do incremento 1 (superado pela atualização abaixo): SEC-03 e INT-01 independentes; SAL-01 depende da autorização, schema e ambiente isolado. Contratos e produto podem avançar; integração final P1 depende dos P0. Não declarar segurança global com base no primeiro incremento.

05/09 — Incremento 2: correções P0 de APIs, grants/RLS, webhook e transação/idempotência implementadas. **npm test: 121/121 testes, 10 arquivos; npm run typecheck: aprovado nos quatro workspaces.** Inclui 43 casos SQL, 1 reabertura PostgreSQL persistido, 18 casos HTTP de webhook e suíte existente. Falha inicial de sintaxe SQL e falha do cliente GET de teste foram corrigidas antes da aprovação. Relatório/arquivos/limites em P0_INCREMENT_2.md. Nenhum item homologado em Supabase/Chatwoot remoto.

Próximo atual: HOM-P0/INT-02 e rotação autorizada SEC-05 antes da liberação operacional. UNI-01 está desbloqueada para avaliação documental, sem implementação. Fluxos comerciais novos e reformulação visual continuam aguardando o gate P0. Histórico do quadro do incremento 1 em history/2026-09-05-increment-1-MVP_TASKS.md.
