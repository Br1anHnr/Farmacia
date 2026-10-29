# MultiFarma Hub

Protótipo para centralizar atendimento e vendas de uma farmácia, integrando o Chatwoot a um hub com contatos, pedidos, relatórios e auditoria.

**Estado:** o projeto não avançou para operação e não possui resultados de negócio aferidos. O repositório reúne implementação, decisões técnicas e roteiros de demonstração; não representa um serviço homologado em produção.

## Problema e proposta

Reunir informações do atendimento e seu desfecho comercial em uma interface que permita acompanhar conversas, transferências, pedidos e indicadores por canal ou unidade.

## Organização

- `apps/web`: interface e rotas em Next.js.
- `apps/integration-service`: serviço de integração em Node.js/Express.
- `packages/contracts`: contratos compartilhados e validação.
- `packages/ui`: componentes compartilhados.
- `tests`: testes existentes.
- `docs`: estado do MVP, decisões e roteiros operacionais.

## O que explorar

| Tema | Documentação |
| --- | --- |
| Estado e limitações | [MVP_STATUS](docs/MVP_STATUS.md) |
| Telas e funcionalidades documentadas | [Walkthrough](walkthrough.md) |
| Demonstração proposta | [Roteiro](docs/DEMO_WALKTHROUGH.md) |
| Chatwoot como inbox | [ADR-001](docs/adr/ADR-001-chatwoot-como-inbox.md) |
| Confirmação humana da venda | [ADR-003](docs/adr/ADR-003-confirmacao-humana-da-venda.md) |

## Desenvolvimento

Instale as dependências com `npm ci`. Configure as variáveis a partir de `.env.example` em ambiente isolado, conforme a documentação operacional. Banco e serviços externos são necessários; não é uma demonstração autônoma.

Em terminais separados:

```sh
npm run dev --workspace=@hub-farmacia/integration-service
npm run dev --workspace=@hub-farmacia/web
```

Scripts disponíveis na raiz:

```sh
npm run typecheck
npm test
npm run build
```

Esses comandos descrevem os scripts existentes. Não foram executados nesta revisão documental e não comprovam homologação.

## Limites

Afirmações históricas de testes devem ser lidas com suas datas e condições. Roteiros apresentam cenários pretendidos, não resultados observados em clientes. Para retomar o projeto, revisar as pendências de homologação e integrações, validar as jornadas em ambiente isolado e produzir uma demonstração com dados fictícios.

O projeto foi realizado em equipe. A divisão das contribuições individuais deve ser documentada antes de atribuir funcionalidades específicas a uma única pessoa.
