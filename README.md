# MultiFarma Hub

Participei da construção de um protótipo para centralizar o atendimento e as vendas de uma farmácia, conectando o Chatwoot a um hub com contatos, pedidos, relatórios e auditoria.

O projeto foi interrompido antes de entrar em operação. Mantenho aqui o código e as decisões da equipe; não obtive resultados de negócio com a solução.

## A proposta

Queríamos reunir as informações do atendimento e seu desfecho comercial em uma interface para acompanhar conversas, transferências, pedidos e indicadores por canal ou unidade.

Trabalhei nesse projeto em equipe. As funcionalidades e decisões descritas aqui fazem parte dessa construção conjunta.

## Como organizamos o projeto

- `apps/web`: interface e rotas em Next.js.
- `apps/integration-service`: serviço de integração em Node.js/Express.
- `packages/contracts`: contratos compartilhados e validação.
- `packages/ui`: componentes compartilhados.
- `tests`: testes do projeto.
- `docs`: estado do MVP, decisões e roteiros operacionais.

## Documentação

| Tema | Onde encontrar |
| --- | --- |
| Estado e limitações do MVP | [MVP_STATUS](docs/MVP_STATUS.md) |
| Telas e funcionalidades | [Walkthrough](walkthrough.md) |
| Roteiro de demonstração | [Demonstração](docs/DEMO_WALKTHROUGH.md) |
| Uso do Chatwoot como inbox | [ADR-001](docs/adr/ADR-001-chatwoot-como-inbox.md) |
| Confirmação humana da venda | [ADR-003](docs/adr/ADR-003-confirmacao-humana-da-venda.md) |

## Como executar em desenvolvimento

Instale as dependências com `npm ci` e configure as variáveis a partir de `.env.example`, seguindo a documentação operacional. O projeto depende de banco e serviços externos, então use um ambiente isolado de desenvolvimento.

Inicie os serviços em terminais separados:

```sh
npm run dev --workspace=@hub-farmacia/integration-service
npm run dev --workspace=@hub-farmacia/web
```

Para verificar o projeto:

```sh
npm run typecheck
npm test
npm run build
```

## Estado atual

Não considero o protótipo homologado para produção. Os registros de testes estão nos documentos técnicos, com suas datas e condições. Os roteiros descrevem o que planejamos demonstrar, e não resultados de operação em um cliente.

Se retomar o projeto, quero revisar as pendências de integração, validar as jornadas em ambiente isolado e gravar uma demonstração com dados fictícios.
