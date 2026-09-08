import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade | MultiFarma Hub",
  description: "Política de privacidade do MultiFarma Hub para os canais de atendimento da farmácia.",
};

const sections = [
  {
    title: "1. Quem somos",
    paragraphs: [
      "O MultiFarma Hub é a interface operacional usada pela farmácia para organizar atendimentos, contatos e registros comerciais recebidos pelos canais oficiais da MultiFarma.",
    ],
  },
  {
    title: "2. Dados tratados",
    paragraphs: [
      "Podemos receber e organizar nome, identificador do perfil, telefone, mensagens, anexos, data e horário do contato, identificadores de conversa e informações necessárias para encaminhar o atendimento.",
      "Também registramos dados operacionais gerados pela equipe, como responsável pelo atendimento, filial, desfecho, anotações internas e histórico de auditoria.",
    ],
  },
  {
    title: "3. Como usamos os dados",
    paragraphs: [
      "Os dados são usados para responder solicitações, encaminhar conversas à equipe, registrar contatos, acompanhar o atendimento, documentar vendas ou não vendas e produzir indicadores internos da operação.",
      "Não usamos os dados recebidos para vender listas de contatos ou para publicidade de terceiros.",
    ],
  },
  {
    title: "4. Serviços integrados",
    paragraphs: [
      "O Hub integra canais da Meta (Instagram e Messenger), Chatwoot, Supabase e serviços de hospedagem necessários à operação. Cada serviço recebe somente os dados necessários para sua finalidade e conforme suas próprias políticas.",
    ],
  },
  {
    title: "5. Retenção e segurança",
    paragraphs: [
      "Mantemos os registros enquanto forem necessários para o atendimento, continuidade operacional, auditoria e cumprimento de obrigações aplicáveis. Aplicamos autenticação, controle de acesso por perfil e filial, isolamento de dados e registros de auditoria.",
      "Nenhum sistema conectado elimina completamente riscos de segurança. Em caso de suspeita de acesso indevido, a equipe responsável deve ser comunicada pelos canais oficiais da farmácia.",
    ],
  },
  {
    title: "6. Seus direitos",
    paragraphs: [
      "Você pode solicitar confirmação do tratamento, acesso, correção ou exclusão de dados pessoais, observadas as informações que precisem ser mantidas por obrigação legal ou para defesa de direitos.",
      "Para fazer uma solicitação, procure a equipe da MultiFarma pelo canal oficial de atendimento e informe o perfil ou conversa a que o pedido se refere.",
    ],
  },
  {
    title: "7. Atualizações",
    paragraphs: [
      "Esta política pode ser atualizada quando os canais, serviços ou finalidades da operação mudarem. A versão vigente estará sempre disponível nesta página.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <header className="border-b border-slate-200 pb-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-600">MultiFarma Hub</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Política de Privacidade</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
            Esta política explica como a MultiFarma trata dados recebidos pelos seus canais de atendimento e pelo Hub operacional.
          </p>
          <p className="mt-4 text-xs text-slate-500">Última atualização: 7 de setembro de 2026</p>
        </header>

        <div className="divide-y divide-slate-100">
          {sections.map((section) => (
            <section key={section.title} className="space-y-3 py-7 first:pt-8 last:pb-2">
              <h2 className="text-lg font-semibold text-slate-950">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-7 text-slate-700">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <footer className="mt-8 border-t border-slate-200 pt-6 text-xs leading-6 text-slate-500">
          Para dúvidas ou solicitações sobre privacidade, utilize o canal oficial de atendimento da MultiFarma e informe que o pedido se refere ao MultiFarma Hub.
        </footer>
      </article>
    </main>
  );
}
