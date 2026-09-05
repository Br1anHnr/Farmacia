# PRD — MultiFarma Hub

Versão: 1.1 — Revisão de adequação operacional e homologação
Data: 05/09/2026
Status: base implementada, com correções e homologação pendentes. Não aprovado para produção com dados reais nesta revisão.
Responsáveis: Brian — produto e gestão; Fábio — segurança, dashboard e interface; Vitor — backend, infraestrutura e integrações.

## 1. Objetivo e limites desta revisão

Evoluir o MVP existente para preservar as funções utilizadas pelo cliente no sistema anterior, atender às solicitações do vídeo e oferecer uma operação simples, identificada com a farmácia e com dados confiáveis.

Não reconstruir a mensageria nem descartar o trabalho existente. Manter Chatwoot como central de conversas e o Hub como complemento operacional e gerencial. A evolução é incremental, por dependências, com meta de uma semana para uma demonstração funcional revisada; essa meta não equivale a liberação automática para produção.

Fontes: PRD 1.0 enviado por Brian; vídeo de 2min18s e imagens; inspeção estática de arquivos selecionados do repositório Br1anHnr/Farmacia, branch main, commit a9aca040b91bd7b4ba8c383d69c65485798fba58. Não foram executados testes, acessados bancos reais ou verificados o deploy e as configurações dos canais. Mudanças locais ainda não enviadas ao GitHub não estão cobertas.

Este documento substitui as declarações de conclusão integral do PRD anterior. Preserva seu escopo principal, mas não considera referências a testes simulados como prova de homologação dos canais, RLS ou segurança em produção.

## 2. Diagnóstico corrigido

O cliente já utiliza um sistema com recursos de atendimento, contatos, relatórios e configurações. Não presumir que todos esses recursos estão ausentes na operação atual. O desafio é oferecer continuidade operacional, melhorar a experiência e implementar o que foi solicitado.

O vídeo confirma com boa clareza transferência, encerramento comercial com valor e motivo, conservação de contatos, origem por canal, distinção entre status e contato direto, relatórios de tempo e histórico. Distribuição da fila, quantidade de colaboradores e trecho sobre conexão de filiais precisam de confirmação. Pesquisa de satisfação fica fora da prioridade inicial; validar essa leitura com o cliente.

Os recursos já combinados anteriormente continuam no escopo: WhatsApp, Instagram Direct e Messenger, áudio, notas privadas, chat interno, dashboard apenas para gerente, triagem e confirmação humana de vendas.

## 3. Situação encontrada no código

| Área | Evidência inspecionada | Classificação e ação |
|---|---|---|
| Acesso gerencial | Middleware e API usam x-user-role/cookie de papel; middleware aceita cabeçalho como autenticação | Correção crítica antes de dados reais. Validar sessão e permissões no servidor. |
| Vendas | API grava cabeçalho, itens e auditoria separadamente; possui resposta 201 com fallback se venda não persistir | Parcial. Garantir transação, identidade autenticada, idempotência e falha explícita. |
| Indicadores | API consulta vendas, mas cria venda demonstrativa em lista vazia e calcula conversas com Math.max(confirmedSalesCount + 2, 5) | Parcial. Conversão e estado vazio não são evidência operacional confiável. |
| Contatos | Webhook tenta cadastrar clientes e canais; há organização fixa e fluxo sem telefone sem busca prévia por identidade do canal | Parcial. Resolver organização/inbox e deduplicar por identificador estável. |
| Extração | extraction.ts usa seis produtos/preços fixos, regras de texto, confiança 0,88 e memória local | Heurística demonstrativa; não classificar como IA validada em produção. |
| Chat interno | Tela consulta mensagens a cada três segundos e fixa duas salas | Parcial. Não descrever como assinatura Supabase Realtime já comprovada. |
| Interface | Tema escuro/verde, termos técnicos e indicadores ONLINE/usuários fixos | Adequar marca, rótulos, estados reais e navegação por perfil. |
| Testes | e2e-simulation.test.ts simula mensagens, valida contratos e objetos locais | Útil para regressão; não comprova envio real de áudio, canais, persistência ou isolamento. |
| Infra e webhooks | Serviço declara conexão Chatwoot no health e não apresenta autenticação nas rotas inspecionadas | Revisar autenticação e exposição de rede; configuração do servidor não foi inspecionada. |

Esses achados não significam que o projeto deva ser refeito. São critérios para distinguir demonstração, implementação parcial e operação homologada.

## 4. Arquitetura preservada

- Chatwoot self-hosted: mensagens, anexos, histórico operacional, atribuições, equipes e notas. Homologar cada capacidade na edição/versão instalada.
- Evolution API: adaptador de WhatsApp; validar reconexão, duplicidades, áudio e limitações do modo utilizado. Não prometer ausência de bloqueios, custo zero ou migração sem esforço.
- Instagram e Messenger: canais com credenciais e permissões próprias; identificar configurações/aprovações pendentes.
- Serviço de integração: validar eventos, resolver conta/inbox/organização/filial, persistir estado e sincronizar dados comerciais.
- Hub web: painel lateral de atendimento, chat interno e área gerencial.
- Supabase: autenticação e dados do Hub. Banco operacional do Chatwoot permanece separado.
- Hostinger/Coolify: deploy, segredos, rede, logs, backup e restauração.

O Chatwoot continua sendo a fonte operacional das mensagens e atribuições. O Hub registra desfechos e vendas; métricas operacionais vêm de eventos sincronizados e reconciliados. Não duplicar o conteúdo integral de receitas e conversas sem necessidade.

## 5. Perfis e permissões

| Perfil | Permitido | Restrições |
|---|---|---|
| Atendente | Conversas autorizadas, contato, áudio, transferência, registro de venda e salas permitidas | Sem dashboard, relatórios agregados ou acesso a outras unidades sem vínculo |
| Gerente | Dashboard e relatórios no escopo autorizado; gestão comercial e auditoria pertinente | Não ganha acesso a outra organização |
| Administrador técnico | Usuários, configuração e saúde técnica necessárias | Sem acesso gerencial automático; acesso comercial exige autorização de gerente |
| Auditor | Fora do MVP revisado por padrão | Se necessário, definir autorização específica sem conceder automaticamente dashboard |

Resolver a divergência do PRD 1.0 que concedia dashboard ao admin/auditor: prevalece o pedido de acesso exclusivo de gerente. UI oculta não é controle de segurança. Validar permissão em cada API e acesso ao banco, inclusive no painel incorporado ao Chatwoot.

## 6. Requisitos funcionais e aceite

### RF-01 — Atendimento e continuidade

Preservar conversas por cliente/canal, fila de espera, responsável, transferência entre usuários/equipes autorizados, notas privadas, mensagens prontas e áudio/anexos. Evitar múltiplos atendentes assumindo a mesma conversa sem controle.

Aceite: duas contas de atendentes testam recebimento, resposta, transferência e retomada sem perder histórico; áudio é enviado e reproduzido nos canais aplicáveis. Registrar diferenças por canal. Definir com cliente a regra de distribuição; não pressupor rodízio.

### RF-02 — Encerramento comercial

Adicionar ação simples “Encerrar atendimento”, com desfechos: venda realizada; não vendido; dúvida resolvida/sem intenção comercial; cancelado/duplicado. Venda exige confirmação humana e valor; não vendido exige motivo de lista curta e observação opcional. Não confundir venda cancelada com atendimento que não converteu.

Motivos iniciais propostos: preço, indisponibilidade, prazo/entrega, desistência, sem retorno, outro. Validar nomes com Brian/cliente. Permitir encerramento com valor total quando não houver itens detalhados; marcar venda sem detalhamento e excluí-la do ranking de produtos.

Aceite: persistência confirmada antes de mostrar sucesso; repetição do envio não duplica venda. Registrar autor, horário, conversa, canal e filial. Correção/reabertura preserva trilha anterior. Auditar divergência se a conversa for encerrada diretamente pelo Chatwoot; não prometer bloqueio do botão nativo sem validar a integração. Exibir pendência de classificação até reconciliar.

### RF-03 — Contatos

Cadastrar/atualizar contato na entrada da conversa, mesmo sem compra. Consultar contatos no Chatwoot no primeiro incremento; criar tela própria apenas se houver lacuna comprovada. Normalizar telefone e deduplicar por organização + provedor/conta + identificador externo. Não unir pessoas apenas por nome.

Aceite: duas mensagens do mesmo usuário sem telefone não criam dois clientes; homônimos permanecem separados; não misturar organizações. Importação da base antiga depende de exportação autorizada e amostra validada, sem apagar o original.

### RF-04 — Origem e atribuição

Separar canal (WhatsApp, Instagram, Messenger) de origem comercial (contato direto, status, anúncio, indicação, desconhecida). Guardar origem, forma de identificação e evidência/referência mínima.

Aceite: usar metadados reais quando disponíveis; permitir classificação manual. Ausência de metadados resulta em “Desconhecida”, nunca em atribuição inventada. Identificação automática de status depende de teste do provedor. Não usar o campo atual origin_type de venda/extração como se fosse origem de marketing.

### RF-05 — Dashboard exclusivamente gerencial

Exibir atendimentos recebidos, aguardando, em atendimento e encerrados; vendas registradas no Hub, valor, ticket médio, conversão, motivos de não venda, produtos detalhados mais vendidos, canal/origem, filial e colaborador. Filtros de período e escopo aplicados no backend.

Definições propostas: ticket médio = valor das vendas confirmadas válidas / quantidade dessas vendas; conversão = atendimentos comerciais encerrados com venda / atendimentos comerciais encerrados elegíveis. Uma conversa com várias vendas conta uma vez no numerador da conversão. Período e regra de reabertura precisam ser consistentes e documentados; pendências de classificação aparecem separadamente.

Não chamar valor do Hub de faturamento fiscal ou conciliação do caixa. Sem ERP, o indicador representa vendas registradas manualmente e confirmadas no atendimento.

Aceite: totais conciliam com registros de exemplo e filtros; dados vazios mostram zero/sem dados; indisponibilidade mostra erro. Dados demonstrativos só em ambiente explicitamente identificado, nunca como fallback silencioso.

### RF-06 — Tempos e histórico

Registrar início, primeira resposta humana, atribuições, transferências, encerramento e reabertura. Separar espera até primeira resposta humana de duração até encerramento. Respostas do bot não contam como humanas. Não chamar duração total de “tempo ativo do atendente”; medir segmentos por responsável quando necessário.

Aceite: reconstruir uma transferência e identificar quem enviou cada mensagem e quem realizou cada ação. Histórico da conversa e auditoria são recursos distintos. Histórico, mídia e backup precisam sobreviver a reinício e restauração testada; retenção será definida com o cliente, não ilimitada por padrão.

### RF-07 — Bot e sugestões

Manter saudação curta, captura do produto desejado e encaminhamento humano. Nunca diagnosticar, interpretar receita, prescrever ou confirmar estoque/preço sem fonte válida. Bot para de responder quando humano assume; estado e deduplicação devem sobreviver a reinícios e múltiplas instâncias.

Aceite: ensaiar corrida entre bot e humano, webhook repetido, reordenação e reinício. Sugestões são editáveis e confirmadas pelo atendente. Catálogo/preços demonstrativos não podem alimentar vendas reais. IA generativa adicional não é requisito para concluir esta revisão.

### RF-08 — Equipe, unidades e comunicação interna

Preservar chat interno, com salas conforme vínculos e identidade do remetente obtida no servidor. Salas e usuários não devem ser fixos no código. Suportar estrutura com múltiplas unidades; hipótese de teste: dez contas, sujeita à confirmação do cliente. Isso não substitui teste de carga pelo volume real de mensagens.

Aceite: mensagem de uma sala não aparece para usuário sem vínculo; envio com falha permite repetir sem duplicar. Aceitar polling documentado como solução provisória se adequado ao teste; não rotular como Realtime implementado sem assinatura real.

## 7. UI/UX e identidade visual — requisito de produto

A marca visível nas imagens é “Pharma Chat Bot”, possivelmente do fornecedor atual. Não assumir que logo e paleta pertencem à farmácia. Obter logotipo/nome comercial/cores autorizados; enquanto faltarem, usar tema provisório claramente identificado.

Diretrizes:

- Experiência do atendente centrada em Atendimento, Contatos e Equipe. Gerente recebe também Visão geral, Relatórios e Auditoria; configurações conforme permissão.
- Rótulos de negócio: “Registrar venda”, “Transferir”, “Encerrar”, “Mensagens prontas”. Remover da interface operacional termos como Widget, PostgreSQL, RLS, Supabase e API.
- Cabeçalho informa unidade, usuário e canal/contexto da conversa. Manter distinção visual inequívoca entre mensagem ao cliente, nota privada e chat da equipe.
- Aplicar tokens de marca em login, navegação, formulários e área gerencial; tipografia legível, contraste, foco visível e estados não dependentes apenas de cor.
- Definir estados de carregamento, vazio, erro, reconexão e sucesso. Não exibir ONLINE ou número de usuários sem fonte real.
- Preferir painel lateral compacto com campos progressivos, sem forçar passagem pelo dashboard para vender. Não exigir que o atendente preencha cadastro completo para responder.
- Preservar Chatwoot inicialmente; verificar possibilidades e licença de personalização da versão instalada. Não presumir que um iframe permita personalizar todo o inbox ou que um novo frontend de mensagens caiba nesta semana.

Aceite de usabilidade proposto: Brian e um representante operacional executam receber, responder, transferir, vender, encerrar sem venda e consultar histórico sem orientação passo a passo. Meta: desfecho sem venda em até três ações após abrir encerramento; campos comerciais extras apenas quando necessários. Validar viewport de 1366×768 e painel lateral sem cortes de controles essenciais; acesso por teclado e zoom 200% com navegação utilizável. Homologação visual depende de telas executadas, não apenas revisão de CSS.

## 8. Segurança e confiabilidade — bloqueadores

1. Sessão validada no servidor em todas as rotas sensíveis. Não confiar em x-user-role, cookie de papel, localStorage, nome ou agent_id enviados pelo cliente como autorização/autoria.
2. Obter organização, unidades e atribuições de vínculos autorizados. Testar IDs de outra unidade/organização e acesso direto à API, não só navegação.
3. Chaves privilegiadas somente no servidor; não supor que RLS protege consultas feitas com credencial privilegiada. Separar cliente autenticado do serviço interno autorizado. Revisar políticas, grants e funções com testes reais em ambiente isolado.
4. Webhooks e endpoints internos autenticados conforme recursos disponíveis; origem permitida, replay, limites, filas/retries e rede documentados. Prefixo /internal sozinho não protege uma rota.
5. Venda, itens e auditoria comercial consistentes em transação; retorno de falha quando persistência falhar. Cálculos monetários determinísticos em decimal ou centavos com regra de arredondamento testada.
6. Trilha com autor real, organização, entidade, horário e mudanças; restrição de edição/exclusão. “Append-only” não equivale a inviolabilidade contra administrador do banco.
7. Não registrar conteúdo integral de mensagens/receitas em logs. Minimizar dados pessoais; controlar mídia, exportações, retenção e acessos.
8. Backup dos dados e mídias de Chatwoot e Hub, restauração ensaiada, monitoramento real e procedimento de contingência.
9. Demonstração com dados sintéticos isolados. Não usar receitas ou credenciais reais para demonstração antes das validações.

## 9. Plano incremental — janela de até sete dias

As fases são dependências, não dias obrigatórios. Começar imediatamente tarefas desbloqueadas e antecipar entregas prontas. O prazo será reestimado após a fase A, sem ocultar bloqueadores para manter uma data.

| Fase | Responsável principal | Trabalho em paralelo permitido | Dependência / saída |
|---|---|---|---|
| A — Base factual e critérios | Brian | Fábio desenha fluxos; Vitor levanta canais/configuração | Inventário, aceite, ambiguidades e plano atualizados |
| B — Segurança e persistência | Fábio + Vitor | Brian valida linguagem, motivos e marca | Autorização, escopos e falhas de venda cobertos por testes |
| C — Encerramento, contatos e eventos | Vitor | Fábio implementa telas com contratos acordados | Fluxo salvo, deduplicado e auditável |
| D — Indicadores e identidade | Fábio | Brian faz testes de usabilidade; Vitor reconcilia eventos | KPIs reais e navegação simples por perfil |
| E — Homologação e demonstração | Brian, com Fábio e Vitor | Correções pequenas separadas por responsável | Matriz de aceite com evidência e limitações explícitas |

Distribuição de referência: A no início; B nas primeiras 24–48h; C/D no meio da janela; E ao final. Não esperar calendário quando dependências estiverem concluídas. Vitor não precisa esperar o visual para definir contratos; Fábio não precisa esperar canais reais para validar protótipos com dados sintéticos.

Prioridades P0: segurança, persistência correta, remoção de métricas fictícias e separação demo/real. P1: encerramento, motivos, contatos, relatórios básicos e identidade. P2: atribuição automática de status, relatórios avançados, importações em massa e customização profunda do Chatwoot. Recursos de atendimento usados pelo cliente não podem ser removidos silenciosamente por mudança de prioridade.

## 10. Definição de concluído e acompanhamento

Cada tarefa deve conter: ID, requisito, responsável, dependências, status, evidência, teste, bloqueio e próximo passo. Estados: a fazer; em andamento; implementado; testado localmente; homologado; bloqueado. Evitar percentuais sem base.

Para demonstração: fluxo essencial executável com dados sintéticos, modo identificado, limitações explícitas e sem contornar autorização. Para produção: testes negativos de sessão/RLS, transação, idempotência, bot/humano, contatos sem telefone, canais e áudio reais, persistência após reinício, backup/restauração e validação do cliente.

Não declarar 100% a partir de contagem de testes. A inspeção desta revisão não executou a suíte existente e não atesta a segurança do ambiente implantado.

## 11. Fora do incremento e decisões abertas

ERP/estoque/PDV: identificar produto, API, permissões e dados antes de estimar. Não incluir sincronização bidirecional, fiscal, prescrição digital, farmacovigilância, e-commerce ou recompra preditiva como compromisso automático. Integração oficial WhatsApp e catálogos comerciais exigem validação própria; não prometer selo/verificação como consequência da integração.

Confirmar com o cliente: marca autorizada, número de usuários/unidades, distribuição de fila, funções realmente usadas, critérios de encerramento, relatórios prioritários, acesso a histórico por filial, retenção, exportação do sistema antigo e volume de pico. Falta dessas respostas não bloqueia corrigir P0 nem construir fluxo demonstrativo com hipóteses explícitas.

## 12. Evidências técnicas da revisão

Base fixa para os links: commit a9aca040b91bd7b4ba8c383d69c65485798fba58.

- [Middleware](https://github.com/Br1anHnr/Farmacia/blob/a9aca040b91bd7b4ba8c383d69c65485798fba58/apps/web/src/middleware.ts)
- [Resumo gerencial](https://github.com/Br1anHnr/Farmacia/blob/a9aca040b91bd7b4ba8c383d69c65485798fba58/apps/web/src/app/api/dashboard/summary/route.ts)
- [Registro de vendas](https://github.com/Br1anHnr/Farmacia/blob/a9aca040b91bd7b4ba8c383d69c65485798fba58/apps/web/src/app/api/sales/route.ts)
- [Integrações e contatos](https://github.com/Br1anHnr/Farmacia/blob/a9aca040b91bd7b4ba8c383d69c65485798fba58/apps/integration-service/src/server.ts)
- [Extração atual](https://github.com/Br1anHnr/Farmacia/blob/a9aca040b91bd7b4ba8c383d69c65485798fba58/apps/integration-service/src/services/extraction.ts)
- [Simulação de fluxo](https://github.com/Br1anHnr/Farmacia/blob/a9aca040b91bd7b4ba8c383d69c65485798fba58/tests/e2e-simulation.test.ts)

## 13. Prompt de execução incremental

```text
Use o PRD MultiFarma v1.1 como revisão de escopo do projeto existente. Primeiro compare-o com a versão atual do repositório, incluindo mudanças posteriores ao commit de referência. Preserve o que funciona; não reinicie o MVP nem reconstrua a mensageria.

Atualize a documentação do projeto e o quadro de tarefas com responsável (Brian: produto/gestão; Fábio: segurança/dashboard/interface; Vitor: backend/infra/integrações), dependências, status real, evidência e próximo passo. Planeje uma janela de até sete dias por marcos desbloqueáveis, não por dias de espera.

Comece pelos P0: autorização validada no servidor, isolamento de organização/unidade, segurança das APIs/webhooks, persistência transacional/idempotente de vendas e remoção de sucesso e indicadores fictícios fora do modo demo. Valide se os achados ainda existem antes de corrigi-los.

Depois execute encerramento comercial, motivos de não venda, contatos deduplicados, métricas operacionais reais e UI/UX da farmácia. Use identidade provisória até receber os ativos autorizados; não copie automaticamente a marca Pharma Chat Bot do fornecedor. Mantenha dashboard exclusivo de gerente, chat interno separado das conversas de clientes e sugestões sempre confirmadas por humano.

Implemente em incrementos pequenos com testes e atualização do quadro a cada entrega. Separe implementado, testado localmente e homologado em canal real. Trate capacidades/configurações do Chatwoot e origem por status como itens a validar. Não apresente mock como integração real.

Não aplique alterações em banco de produção, faça deploy ou migre dados/canais sem autorização específica. Quando faltar uma decisão do cliente, registre hipótese e avance nas tarefas independentes. Comece agora pela inspeção e primeira correção P0 comprovada; ao concluir, informe o que mudou, os testes executados e o próximo marco.
```
