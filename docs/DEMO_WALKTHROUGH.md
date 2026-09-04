# Roteiro de Demonstração Operacional — MVP Hub MultiFarma

Este documento orienta a equipe (Brian, Fábio e Vitor) na condução da demonstração funcional de 7 dias com o cliente da farmácia, validando os 11 pontos essenciais do PRD sem o uso de dados reais ou riscos regulatórios.

---

## Preparação do Ambiente

1. Certifique-se de que os serviços estão iniciados:
   ```bash
   # Terminal 1: Serviço de Integração
   npm.cmd run dev --workspace=@hub-farmacia/integration-service

   # Terminal 2: Aplicação Web
   npm.cmd run dev --workspace=@hub-farmacia/web
   ```
2. Abra os navegadores nos endereços:
   - Hub Web / Dashboard: `http://localhost:3000`
   - Painel do Atendente (Dashboard App): `http://localhost:3000/chatwoot-widget`
   - Health Check: `http://localhost:3001/internal/health`

---

## Roteiro Passo a Passo da Demonstração

### 1. Recepção da Mensagem e Triagem Automática do Bot
* **Ação:** Envie uma mensagem simulada de cliente para a farmácia:
  > *"Olá, boa tarde! Gostaria de saber o preço de dipirona para entregar no Centro."*
* **Evidência para o Cliente:**
  - A mensagem é recebida no inbox unificado;
  - O AgentBot responde cordialmente em segundos confirmando que a farmácia tem a Dipirona e já está acionando um atendente humano;
  - A intenção `BUY_PRODUCT` e o produto `Dipirona` são classificados automaticamente.

---

### 2. Passagem para Humano e Desligamento Atômico do Bot
* **Ação:** No Chatwoot, a atendente **Ana Souza** abre a conversa e envia uma resposta:
  > *"Boa tarde! Sou a Ana, farmacêutica. Temos a caixa com 20 comprimidos por R$ 8,50. Quantas caixas você precisa?"*
* **Evidência para o Cliente:**
  - O bot é desativado atomicamente (`bot_active = false`);
  - O cliente envia outra mensagem e **o bot não interfere nem responde nada**, mantendo a conversa 100% humanizada.

---

### 3. Cenário com Envio de Receita Médica
* **Ação:** O cliente envia uma imagem simulada de receita médica:
  > *"Tenho a receita médica aqui, segue a foto."*
* **Evidência para o Cliente:**
  - O bot confirma o recebimento educadamente: *"Recebemos sua receita médica com sucesso. Nossa equipe farmacêutica já está verificando..."*;
  - **Zero interpretação clínica por IA:** o sistema não tenta diagnosticar nem prescrever;
  - O anexo fica visível com segurança exclusivamente para a farmacêutica no Chatwoot.

---

### 4. Transferência entre Atendentes e Filiais
* **Ação:** A atendente Ana adiciona uma **Nota Privada**:
  > *"Cliente precisa de entrega urgente na região dos Jardins. Transferindo para filial correspondente."*
* **Ação 2:** Ana transfere o atendimento para o atendente **Bruno Lima** (Filial Jardins).
* **Evidência para o Cliente:**
  - A nota privada permanece invisível para o cliente;
  - Bruno recebe a conversa imediatamente com todo o histórico preservado;
  - O evento de transferência é registrado na trilha de auditoria do Hub.

---

### 5. Sugestão Silenciosa de IA e Confirmação Humana da Venda
* **Ação:** Bruno abre a Dashboard App lateral no Chatwoot (`/chatwoot-widget`).
* **Evidência para o Cliente:**
  - O painel lateral já identifica o cliente e exibe o cartão: *"Sugestão Extraída do Chat: 2x Dipirona 500mg para Entrega (88% confiança)"*;
  - O atendente clica em *"Preencher Formulário com Sugestão"*;
  - O formulário calcula o total exato (2x R$ 8,50 = R$ 17,00);
  - Bruno clica no botão verde **"Confirmar Venda (Humano)"**;
  - A venda é gravada no Supabase como `confirmed`.

---

### 6. Dashboard Gerencial Exclusivo e Acesso Negado
* **Ação:**
  1. Entre como **Carlos Mendes (Gerente)** e acesse `/dashboard`:
     - Mostre o faturamento consolidado, ticket médio, conversão e ranking de produtos;
     - Mostre os filtros por canal e unidade.
  2. Alterne para a atendente **Ana Souza** e tente acessar `/dashboard`:
     - A tela de **Acesso Negado (HTTP 403)** é exibida imediatamente, provando que o atendente não enxerga dados gerenciais ou vendas dos colegas.

---

### 7. Trilha de Auditoria e Chat da Equipe
* **Ação:**
  - Acesse `/audit` como gerente e mostre o log imutável com a confirmação da venda realizada minutos antes;
  - Acesse `/chat` e envie uma mensagem na *Sala Filial Jardins*, mostrando a comunicação em tempo real da equipe.

---

## Critérios de Sucesso Aprovados
- [x] Omnichannel operacional e unificado
- [x] Triagem e handoff atômico bot -> humano
- [x] Regra de segurança estrita para receitas médicas
- [x] Confirmação humana obrigatória de vendas
- [x] Dashboard restrito exclusivamente ao perfil `manager`
- [x] Auditoria append-only completa
