# Janela de demonstração — até sete dias

Referência: 05/09 a 11/09/2026, sujeita à reestimativa conforme evidências. Marcos são limites de planejamento, não dias de espera: concluídas as dependências, avançar imediatamente. Quadro detalhado em MVP_TASKS.md.

| Marco / janela alvo | Saída verificável | Responsáveis e dependências |
|---|---|---|
| A — início 05/09 | Diagnóstico, PRD/quadro e critérios reais | Brian REV-01; Fábio SEC-01/02; Vitor INT-01 e ambiente isolado sem esperar produto |
| B — primeiras 48 h | APIs autorizadas, isolamento e venda sem falso sucesso; demo isolada | Fábio SEC-03/04/DEM-02; Vitor INT-01/SAL-01/BOT-01; Brian motivos/marca/acesso de teste |
| C — até 08/09, antecipável | Desfechos/contatos persistidos e eventos mínimos | Vitor CON-01/COM-01/EVT-01; Fábio COM-02/CHAT-01 por contrato; Brian linguagem |
| D — até 09–10/09, antecipável | Relatórios conciliáveis e fluxo operacional legível | Fábio KPI-01/UX-01 após eventos; Vitor concilia fontes; Brian usabilidade |
| E — até 11/09 | Demonstração sintética e matriz de homologação/limitações | Brian DEMO-01/HOM-01; Fábio correções; Vitor OPS-01 |

Caminho crítico: SEC-03/04 + INT-01 → SAL-01/CON-01 → COM-01/EVT-01 → COM-02/KPI-01 → DEMO-01. UX, linguagem, ambiente e contratos podem avançar em paralelo na equipe. Não houve delegação automática nesta execução.

Cada incremento: implementar → testar → registrar no quadro → avançar. Falha exige correção, não conclusão. Brian produto/gestão/cliente; Fábio segurança/dashboard/interface; Vitor backend/infra/integrações.

Demonstração: login por perfil, receber/responder/transferir pelo Chatwoot, venda e não venda, contato/histórico, relatório conciliável e equipe isolada. Dados sintéticos identificados e limitações registradas. Canais reais dependem de contas/ambiente de teste definidos; falta de homologação não pode ser substituída por mock.

Não estão autorizados deploy, banco de produção, importação de clientes ou migração de canais. ERP fora do incremento. Marca/vídeo original/quantidade de usuários não bloqueiam P0. Histórico em history/2026-09-05-before-review-MVP_7_DAY_PLAN.md.

## Atualização por dependência — incremento 2

SEC-03/04, INT-01 e SAL-01 têm implementação e testes locais concluídos (121 testes totais + tipos). Antecipar HOM-P0 e INT-02 quando o ambiente isolado/emissor forem definidos, sem esperar dia terminar. Brian agenda validação; Fábio conduz negativos do Supabase; Vitor valida emissor/conta/inbox e rotação autorizada. UNI-01 pode preparar a avaliação documental; implementação visual/comercial permanece condicionada ao gate P0. A meta de sete dias não elimina bloqueadores externos nem autoriza produção.
