import { type ExtractionSuggestion, type FulfillmentMethod } from '@hub-farmacia/contracts';

export class SilentExtractionService {
  private suggestions: ExtractionSuggestion[] = [];

  public extractFromText(
    organizationId: string,
    conversationId: number,
    messageId: number,
    text: string
  ): ExtractionSuggestion | null {
    const lower = text.toLowerCase();

    // Produtos mapeados do catálogo provisório
    const catalogPrices: Record<string, number> = {
      'dipirona': 8.50,
      'paracetamol': 12.00,
      'amoxicilina': 28.90,
      'dorflex': 22.50,
      'omeprazol': 15.00,
      'vitamina c': 19.90,
    };

    let detectedProduct: string | null = null;
    let unitPrice: number | null = null;

    for (const [prod, price] of Object.entries(catalogPrices)) {
      if (lower.includes(prod)) {
        detectedProduct = prod.charAt(0).toUpperCase() + prod.slice(1);
        unitPrice = price;
        break;
      }
    }

    if (!detectedProduct) {
      return null;
    }

    // Extração de quantidade
    let quantity = 1;
    const qtyMatch = lower.match(/(\d+)\s*(caixa|unidade|cartela|frasco|cx)?/);
    if (qtyMatch && qtyMatch[1]) {
      const parsed = parseInt(qtyMatch[1], 10);
      if (parsed > 0 && parsed <= 50) {
        quantity = parsed;
      }
    }

    // Extração de método de atendimento
    let fulfillment: FulfillmentMethod = 'delivery';
    if (lower.includes('retirar') || lower.includes('buscar') || lower.includes('passo aí') || lower.includes('balcão')) {
      fulfillment = 'pickup';
    }

    // Extração básica de endereço
    let address: string | undefined;
    const addressMatch = text.match(/(rua|av\.|avenida|alameda|travessa)\s+[^,\n]+(,\s*\d+)?/i);
    if (addressMatch) {
      address = addressMatch[0];
    }

    const suggestion: ExtractionSuggestion = {
      id: `sug_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      organization_id: organizationId,
      chatwoot_conversation_id: conversationId,
      source_message_id: messageId,
      source_text: text,
      suggested_product_name: detectedProduct,
      suggested_quantity: quantity,
      suggested_unit_price: unitPrice,
      suggested_fulfillment: fulfillment,
      suggested_address: address,
      confidence: 0.88,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    this.suggestions.push(suggestion);
    return suggestion;
  }

  public getSuggestionsForConversation(conversationId: number): ExtractionSuggestion[] {
    return this.suggestions.filter(s => s.chatwoot_conversation_id === conversationId);
  }

  public clearSuggestions(): void {
    this.suggestions = [];
  }
}

export const silentExtractionService = new SilentExtractionService();
