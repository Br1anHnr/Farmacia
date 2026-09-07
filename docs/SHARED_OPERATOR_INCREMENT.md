# Operação com agente Chatwoot compartilhado — 2026-09-07

Decisão solicitada: usar o agente real MultiFarma no Chatwoot; cada colaborador continua identificado no Hub. `assigned_user_id` e auditoria representam o colaborador, `chatwoot_assignee_id` representa o operador compartilhado. Não usar contas de e-mail fictícias para autorizar a operação no Chatwoot.

## Plano e evidências

| Tarefa | Responsável | Dependência | Status | Evidência | Próximo passo |
|---|---|---|---|---|---|
| Separar operador e responsável, manter RLS e preservar responsável após webhook | Vitor | decisão de produto | implementado/testado localmente; estrutura aplicada ao Supabase | shared-operator-database.test.ts; migration shared_chatwoot_operator | publicar backend e ativar modo |
| Transferir/assumir com etiqueta, preservar outras etiquetas e compensar falha | Vitor | estrutura de banco | implementado/testado localmente | chatwoot-conversation-flow.test.ts | homologar Chatwoot real após publicação |
| Corrigir consulta ambígua de salas | Vitor | identificar foreign keys | implementado/testado localmente | vínculo explícito internal_rooms_branch_id_fkey; duas FKs confirmadas no catálogo remoto | testar login individual e salas publicadas |
| Desabilitar ações sem contexto autorizado e explicar fechamento indisponível | Fábio | autorização da conversa | implementado | widget e closure-modal | homologar como atendente e gerente |
| Validar fluxo com Brian | Brian | publicação + ativação | pendente | nenhuma homologação real alegada | roteiro abaixo |

## Publicação e ativação

A migration estrutural foi aplicada pelo conector Supabase. A configuração compartilhada permanece desativada até publicar o backend correspondente: ativar enquanto o backend antigo ainda atribui agentes pessoais deixa Hub e Chatwoot inconsistentes. Deploy continua dependendo da autorização do usuário.

Após publicar, ativar somente a conta validada:

```sql
INSERT INTO public.chatwoot_operation_settings (organization_id, account_id, shared_agent_id)
VALUES ('11111111-1111-1111-1111-111111111111', 1, 1)
ON CONFLICT (organization_id, account_id) DO UPDATE SET shared_agent_id = EXCLUDED.shared_agent_id;
```

Nenhuma transferência de conversas existentes foi feita automaticamente. O gerente deve transferir a conversa pelo Hub para o colaborador que a encerrará.

## Homologação

1. Com gerente no Hub e MultiFarma no Chatwoot, abrir conversa 2 e transferir para Ana/Unidade 1. Confirmar agente Chatwoot 1, etiqueta atendente-ana..., demais etiquetas intactas e auditoria com destino Ana.
2. Reabrir o painel e receber evento Chatwoot; confirmar que responsável continua Ana. Entrar como Ana no Hub e encerrar como não venda com motivo; confirmar persistência. Repetir em conversas de teste para venda, resolvido e cancelado.
3. Transferir entre filiais; confirmar responsável e filial preservados após sincronização. Um atendente sem autorização não deve conseguir ler/encerrar a conversa.
4. Entrar no chat interno como Ana: geral e Unidade 1; como gerente: geral e três filiais. Enviar mensagem e confirmar nome e persistência.
5. Testar falha de Chatwoot e de persistência em ambiente de teste: sem sucesso fictício, com restauração de responsável/etiquetas ou indicação explícita de reconciliação.

Testes locais são evidência de implementação, não homologação publicada. Login compartilhado no Chatwoot não identifica quem digitou uma mensagem; o Hub registra o usuário autenticado e o responsável selecionado.
