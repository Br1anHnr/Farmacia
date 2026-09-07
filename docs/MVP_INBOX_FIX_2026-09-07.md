# Correção operacional — inbox e repetição de envio

Base: main 7b41177. Nenhum deploy ou escrita em produção nesta execução.

## Causa comprovada por leituras remotas

Conversa #2: account_id=1, inbox_id=1, assignee_id=1; cliente vinculado no Hub. A API de participantes retorna Ana (2), Carla (4) e Multi Farma (1). Bruno (3) pertence à conta, mas não à inbox 1. Ana/Carla têm confirmed=false (convite pendente); o Hub confundia esse campo com participação na inbox. A listagem aceitava essas agentes e a transferência as rejeitava.

Os vínculos chatwoot_agents existem para os quatro agentes. Ana/Carla estão na Guaratinguetá — Unidade 1; Bruno, Unidade 2; Carlos, vinculado administrativamente ao agente Multi Farma, nas três filiais. A configuração de operador compartilhado está vazia. Existem quatro salas e 12 participações no chat interno.

Referências: [participantes da inbox](https://developers.chatwoot.com/api-reference/inboxes/list-agents-in-inbox), [atribuição oficial](https://github.com/chatwoot/chatwoot/blob/develop/app/services/conversations/assignment_service.rb). A confirmação de e-mail não substitui a consulta de participação nem a confirmação posterior da atribuição.

## Entrega

- Modal sincroniza agentes da conta e consulta participação atual na inbox; mostra só vínculos elegíveis e indica como habilitar ausentes.
- Assumir e transferir revalidam participação no servidor. A API oficial e a releitura da conversa precisam confirmar o destino antes de persistir filial/responsável/auditoria no Hub.
- Preserva todas as etiquetas, substituindo apenas atendente-*. O painel mostra etiquetas reais e atualiza responsável/filial após confirmação.
- Falha de confirmação tenta restaurar estado anterior; falha de restauração exige reconciliação, sem sucesso fictício.
- O pedido atual de atribuição individual prevalece sobre o fluxo compartilhado anterior: configuração compartilhada ativa bloqueia o fluxo com mensagem explícita, evitando divergência entre SQL e API. Nenhuma configuração remota foi removida.
- Encerramento mantém a mesma chave ao repetir o mesmo conteúdo após falha.
- Próximo P1: CHAT-01, repetição idempotente de mensagem interna. Reutiliza UUID da mensagem e ON CONFLICT DO NOTHING, verifica sala/remetente/conteúdo antes de confirmar repetição. Não exige migration, UPDATE ou ampliação de RLS.

## Validação

Smoke local: login, contexto/cliente, assumir, transferir, quatro desfechos, contatos, dashboard, chat interno e webhook. Testes HTTP usam serviços simulados; PostgreSQL local executa migrations/grants/RLS e o retry. Suíte completa executada uma vez: 186/186, 20 arquivos. Typecheck aprovado nos quatro workspaces.

Produção: apenas leituras do Chatwoot/Supabase. Webhook #1 cadastrado em /internal/chatwoot/webhook para message_created, conversation_updated e conversation_status_changed. Não foi enviado WhatsApp nem executado login/transferência/encerramento real nesta execução; ambiente publicado NÃO HOMOLOGADO.

## Configuração e roteiro após redeploy manual

1. Coolify: conferir CHATWOOT_ACCOUNT_ID=1 e CHATWOOT_INBOX_MAP para inbox 1/organização/filial corretas; credencial Chatwoot e chaves Supabase somente no servidor. Conferir APP_ORIGIN e NEXT_PUBLIC_CHATWOOT_ORIGIN (ausentes nos arquivos locais; estado do Coolify não inspecionado). Esta última deve existir no build do frontend. Manter secret/protocolo de webhook compatíveis com o emissor.
2. Supabase: nenhuma migration nova. Manter chatwoot_operation_settings sem operador compartilhado para esta conta. Os vínculos de agentes/filiais atuais foram lidos e confirmados; não criar usuários fictícios adicionais.
3. Chatwoot: Ana já participa da inbox 1. Para Bruno atender essa inbox, adicionar em Configurações → Caixas de entrada → WhatsApp Farmácia → Agentes → Atualizar. Convites pendentes ainda precisam ser aceitos para login pessoal no Chatwoot. Não alterar e-mails reais para contornar confirmação.
4. Entrar no Hub como Carlos, abrir #2 e conferir nome da sessão, cliente e etiquetas. Transferir para Ana, depois Carla; conferir responsável no Chatwoot, Hub, filial e auditoria. Demais etiquetas devem permanecer; etiquetas legadas como atendido-por: são preservadas por exigência do escopo.
5. Como atendente, assumir conversa autorizada; remover um destino da inbox em ambiente de homologação e confirmar ausência no modal e rejeição de envio direto. Falha de Chatwoot deve impedir sucesso local.
6. Encerrar conversas de teste nos quatro desfechos; repetir envio após falha de rede e conferir unicidade. No chat interno, repetir mensagem após perda de resposta: deve existir uma única linha. Conferir contatos e dashboard (apenas gerente).
7. Enviar WhatsApp de teste e conferir entrada no Chatwoot e sincronização do Hub. Essa ação requer ambiente de homologação autorizado; não foi realizada em produção.
