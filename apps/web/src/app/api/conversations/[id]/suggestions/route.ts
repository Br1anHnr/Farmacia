import { NextResponse, type NextRequest } from 'next/server';

const CHATWOOT_BASE_URL = process.env.CHATWOOT_BASE_URL || 'https://chatwoot.projectvalemind.com';
const CHATWOOT_API_TOKEN = process.env.CHATWOOT_API_TOKEN || 'ZJ8tc1X45yjCtFygYaUpky4C';
const CHATWOOT_ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID || '1';

const CATALOG: Record<string, { name: string; price: number }> = {
  dipirona: { name: 'Dipirona 500mg 20 comp', price: 8.50 },
  paracetamol: { name: 'Paracetamol 750mg 20 comp', price: 12.00 },
  amoxicilina: { name: 'Amoxicilina 500mg 21 cápsulas', price: 28.90 },
  dorflex: { name: 'Dorflex 36 comprimidos', price: 22.50 },
  omeprazol: { name: 'Omeprazol 20mg 28 cápsulas', price: 15.00 },
  'vitamina c': { name: 'Vitamina C 1g efervescente', price: 19.90 },
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const conversationId = parseInt(params.id, 10);
  if (!conversationId) {
    return NextResponse.json({ error: 'INVALID_CONVERSATION_ID' }, { status: 400 });
  }

  let suggestions: any[] = [];

  try {
    const res = await fetch(
      `${CHATWOOT_BASE_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/messages`,
      {
        headers: { api_access_token: CHATWOOT_API_TOKEN },
        cache: 'no-store',
      }
    );

    if (res.ok) {
      const data = await res.json();
      const messages: any[] = data?.payload || [];

      // Filtra mensagens enviadas pelo cliente (incoming)
      const incoming = messages.filter(
        (m) => m.content && (m.message_type === 0 || m.message_type === 'incoming')
      );

      // Analisa as mensagens da mais recente para a mais antiga
      for (const m of incoming.reverse()) {
        const text = String(m.content || '').toLowerCase();

        let foundProduct: { name: string; price: number } | null = null;
        for (const [key, item] of Object.entries(CATALOG)) {
          if (text.includes(key)) {
            foundProduct = item;
            break;
          }
        }

        if (foundProduct) {
          // Extrair quantidade
          let qty = 1;
          const qtyMatch = text.match(/(\d+)\s*(caixa|cx|unidade|cartela|frasco|comprimido)?/);
          if (qtyMatch && qtyMatch[1]) {
            const parsed = parseInt(qtyMatch[1], 10);
            if (parsed > 0 && parsed <= 50) qty = parsed;
          }

          // Extrair modalidade (retirada vs entrega)
          let fulfillment: 'delivery' | 'pickup' = 'pickup';
          let address = 'Retirada no Balcão';

          const isPickup =
            text.includes('retirar') ||
            text.includes('retirada') ||
            text.includes('buscar') ||
            text.includes('balcão') ||
            text.includes('pego aí') ||
            text.includes('passo aí');

          const isDelivery =
            text.includes('entrega') ||
            text.includes('entregar') ||
            text.includes('motoboy') ||
            text.includes('mandar') ||
            text.includes('enviar') ||
            text.includes('rua') ||
            text.includes('av.');

          if (isDelivery && !isPickup) {
            fulfillment = 'delivery';
            const addrMatch = m.content.match(/(rua|av\.|avenida|alameda|travessa)\s+[^,\n]+(,\s*\d+)?/i);
            address = addrMatch ? addrMatch[0] : 'Entrega em domicílio';
          } else {
            fulfillment = 'pickup';
            address = 'Retirada no Balcão';
          }

          suggestions.push({
            id: `sug_${m.id || Date.now()}`,
            suggested_product_name: foundProduct.name,
            suggested_quantity: qty,
            suggested_unit_price: foundProduct.price,
            suggested_fulfillment: fulfillment,
            suggested_address: address,
            confidence: 0.96,
            source_text: m.content,
          });

          // Encontrou o produto da última mensagem com intenção de compra
          break;
        }
      }
    }
  } catch (err) {
    console.warn(`[Suggestions API] Falha ao consultar Chatwoot para conv #${conversationId}:`, err);
  }

  // Se nenhuma mensagem com produto foi encontrada na conversa ainda
  if (suggestions.length === 0) {
    suggestions = [
      {
        id: `sug_default_${conversationId}`,
        suggested_product_name: 'Dipirona 500mg 20 comp',
        suggested_quantity: 1,
        suggested_unit_price: 8.50,
        suggested_fulfillment: 'pickup',
        suggested_address: 'Retirada no Balcão',
        confidence: 0.85,
        source_text: 'Sugestão padrão do catálogo',
      },
    ];
  }

  return NextResponse.json({ suggestions });
}
