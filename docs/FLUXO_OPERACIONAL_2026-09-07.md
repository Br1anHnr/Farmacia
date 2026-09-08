# Checkpoint operacional — 07/09/2026

Implementado e testado localmente; ambiente publicado não homologado neste incremento.

## Regras

- Uma organização Chatwoot, agentes individuais e usuários individuais no Hub. O modo compartilhado legado não é aceito pelas APIs operacionais atuais.
- Chatwoot é a referência de atribuição; conta + conversa identificam o vínculo.
- Atendentes e gerentes consultam a fila das filiais autorizadas. Leitura não concede propriedade.
- Atendentes podem transferir conversa de outro responsável dentro do escopo. Destino exige vínculo de filial e participação real na inbox.
- Assumir não substitui agente diferente já atribuído no Chatwoot. Usar transferência explícita.
- Encerrar exige responsável atual ou gerente. Não existe mais atribuição administrativa silenciosa durante encerramento.
- Transferência confirma Chatwoot e etiquetas antes de persistir no Hub; falha de persistência tenta restaurar o estado remoto e informa necessidade de reconciliação se a restauração falhar.
- Etiqueta atual: atendente-nome. Na próxima atribuição, remover atendente-* e atendido-por:*, preservando etiquetas comerciais.
- Falha de contexto mostra estado não confirmado. Encerramentos persistidos aparecem como encerrados.
- Encerramento salva o desfecho e eventual venda pela RPC transacional existente. Falha posterior no Chatwoot retorna 202 com persisted=true e chatwoot_synced=false; o modal mantém a operação aberta para repetição com a mesma chave.
- Login e logout invalidam a identidade exibida nas outras abas. Permissão gerencial continua validada pelo servidor a partir da conta Hub.

## Aplicação e dependências

Migration necessária: supabase/migrations/20260908005645_authorize_branch_attendance.sql.
Ela substitui somente a política de leitura da fila por organização/filial; RPCs de venda e encerramento mantêm validação de proprietário. Não altera dados ou remove histórico.
Não aplicada no ambiente publicado neste incremento. Não houve deploy.

Revisar agentes existentes, mapeamentos e filiais antes da homologação. Cada destino precisa estar na inbox real do Chatwoot. Atribuição automática pode ocupar a conversa antes de alguém clicar em Assumir.

## Validação local

- TypeScript aprovado.
- Suíte completa: 192 testes aprovados, 23 arquivos.
- Inclui PostgreSQL local com migrations, transferência por atendente não proprietário, isolamento de filial, vendas transacionais, webhooks, sessões, contatos e chat interno.
- Integrações HTTP são simuladas nos testes; isso não comprova Chatwoot, WhatsApp ou Supabase publicados.

## Roteiro de homologação

1. Após aplicar a migration e publicar o commit, usar dois perfis de navegador: gerente e atendente.
2. Verificar identidade Hub e acesso gerencial; atendente deve continuar sem dashboard.
3. Abrir conversa realmente livre: assumir como atendente. Repetir com gerente.
4. Transferir Ana para outro atendente habilitado na inbox. Conferir Chatwoot, Hub, filial, auditoria e etiquetas; repetir em filial de destino autorizada.
5. Abrir conversa atribuída a outra pessoa: permitir transferência, impedir assumir e encerramento por não responsável.
6. Encerrar quatro conversas de teste: venda, não venda com motivo, resolvido e cancelado. Conferir venda/itens e dashboard.
7. Simular falha Chatwoot em ambiente de teste: transferência não confirma sucesso; encerramento salvo indica sincronização pendente. Repetir sem duplicar venda.
8. Conferir contato, sala autorizada e recebimento WhatsApp; nenhum vazamento entre organizações/filiais.

## Limites ainda existentes

- Dashboard calcula vendas confirmadas, valores, ticket e distribuições reais. Total de conversas e conversão permanecem indisponíveis; não foram substituídos por números fictícios.
- Reabertura nativa e encerramento diretamente no Chatwoot exigem homologação e reconciliação comercial; este checkpoint não implementa classificação automática.
- Operações entre Chatwoot e Supabase não são uma transação distribuída. Corridas externas e falha da compensação podem exigir reconciliação; não há promessa de atomicidade entre sistemas.
- Nota privada usa marcador da requisição e consulta histórico recente antes de enviar; não representa garantia global de entrega única.
- A conclusão de prontidão depende da homologação publicada, não apenas dos testes locais.
