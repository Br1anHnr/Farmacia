# Comparação PRD 1.1 × checkout

Base local: a9aca04, 05/09/2026. A edição local anterior do PRD foi arquivada antes da revisão. Não houve fetch/pull; este diagnóstico cobre o checkout, não possíveis alterações remotas. O vídeo não foi recebido nesta execução: suas observações são atribuídas ao anexo.

| Requisito | Evidência no código | Após incremento 1 / lacuna remanescente |
|---|---|---|
| Sessão e gerente exclusivo | middleware e APIs summary/audit confiavam em x-user-role/cookie | Corrigidos localmente: sessão no servidor e vínculos atuais. Demais APIs e defaults de login/me continuam pendentes |
| Isolamento | supabaseRest usa chave privilegiada; consultas sem organização | Dashboard filtra organização e filiais vinculadas. Auditoria exige vínculo com todas as unidades, pois legado não tem filial confiável. RLS/grants e outros handlers continuam P0 |
| RLS | migrations/20260903000002: admin recebe dados comerciais; salas gerais sem organização; policies de vínculos ausentes | Não alterado/executado. Revisar funções SECURITY DEFINER, grants e políticas; testar duas organizações/unidades em banco isolado |
| Vendas | api/sales grava cliente/cabeçalho/itens/auditoria separadamente, ignora erros e retorna 201 fictício | P0 aberto: transação, idempotência, autoria, centavos e falha explícita; sem fallback de cliente e sem unir homônimos |
| Integrações | integration-service/server.ts com CORS aberto, endpoints sem autenticação e conteúdo de mensagem em log | P0 aberto: mecanismo suportado pelo Chatwoot instalado, proteção de rotas, replay durável, limites e rede |
| Dados fictícios | summary fabrica venda/produto/conversas; audit fabrica logs; UI fixa tempos e conversão | Removidos da gerência. Conversão/conversas sem base são null; interface mostra indisponível. Chat/vendas/widget/health/extraction/layout ainda exigem revisão |
| Encerramento RF-02 | CreateSaleInput exige itens; não há classificação comercial persistida localizada | Desfechos/motivos, venda total sem itens, origem, correção/reabertura e reconciliação Chatwoot pendentes |
| Contatos RF-03 | webhook usa organização fixa e cria sem busca estável quando não há telefone; venda procura por nome | Resolver conta/inbox/unidade e deduplicar por identidade externa; contatos no Chatwoot primeiro |
| Origem RF-04 | channel e origin_type manual/ai_suggested não representam marketing | Origem manual/desconhecida e evidência pendentes; status automático depende de prova do provedor |
| Relatórios RF-05/06 | cálculo sobre vendas sem base completa de eventos | Filtros backend implementados. Eventos humanos/transferências/reaberturas e conversão elegível pendentes. Totais incompletos por paginação falham explicitamente |
| Bot RF-07 | extraction com catálogo fixo; agentbot/idempotency em memória | Isolar demo, persistir estado/replay e testar corrida humano/bot e reinício |
| Equipe RF-08 | polling 3 s, salas/usuários fixos, autor enviado pelo cliente e fallback 201 | Vínculos/autoria/falha/repetição pendentes. Não chamar polling de Realtime |
| UI/UX | tema e termos técnicos existentes; indicadores fixos | Ajustes mínimos no dashboard; marca autorizada, navegação, estados de todas as telas e validação visual pendentes |
| Continuidade Chatwoot | adaptadores/widget e simulação existem | Receber/responder/transferir/notas/áudio/histórico precisam de duas contas e canais reais de teste |
| Infra | Dockerfile e runbooks existem | Rede/segredos, backup/restauração e persistência após reinício não homologados |

## Evidência desta etapa

- `npx vitest run --config vitest.security.config.ts`: 17/17 testes HTTP simulados aprovados; configuração dedicada não lê .env. Sem banco ou canais reais.
- `npm run typecheck`: aprovado em todos os workspaces.
- A suíte antiga de auth usa credenciais fixas e o vitest.config.ts lê .env; sales-calculation chama o handler de escrita. Não foi executada indiscriminadamente. Separar fixtures locais de integração antes de executar tudo.
- SQL RLS/advisors, navegador, canais, áudio, banco, backup e restauração não foram validados nesta etapa. Não houve deploy ou migração.
- Verificação de sessão conforme [documentação oficial getUser](https://supabase.com/docs/reference/javascript/auth-getuser). Changelog markdown inacessível por limitações de conteúdo/rede; nenhuma biblioteca Supabase foi instalada/atualizada.

## Hipóteses e decisões abertas

Um vínculo de organização por sessão; múltiplos vínculos ambíguos negam acesso até seleção validada. Unidades exigem vínculo explícito inclusive para gerente. Auditoria legada requer todas as unidades até ter atribuição segura por filial. Períodos 7/30 dias são janelas móveis; Hoje inicia à meia-noite de São Paulo.

Brian confirma vídeo original, marca, usuários/unidades, fila, motivos, reabertura, relatórios essenciais, histórico por filial, retenção e volume. Falta dessas respostas não bloqueia P0. ERP e migração/importação de dados/canais fora do incremento.

## Atualização após incremento 2

A tabela acima preserva o diagnóstico do incremento 1. APIs/defaults, grants/RLS, transação de venda e receptor autenticado de webhooks agora têm correção local testada. Catálogo/sucessos fictícios e envio otimista sem persistência foram removidos dos caminhos identificados. Resultado final: 121/121 testes e TypeScript. O roteiro RLS existente foi executado no PostgreSQL local com grants mais restritos; não foi executado em Supabase remoto. Detalhes, arquivos e gates reais em P0_INCREMENT_2.md e MVP_TASKS.md. Nenhuma homologação de canal ou produção foi inferida.
