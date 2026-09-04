import { describe, it, expect } from 'vitest';
import { POST } from '../app/api/sales/route';
import { NextRequest } from 'next/server';

describe('Registro Estruturado e Confirmação de Vendas', () => {
  it('deve calcular subtotal e total com precisão financeira sem ponto flutuante irregular', async () => {
    const salePayload = {
      organization_id: '11111111-1111-1111-1111-111111111111',
      branch_id: '22222222-2222-2222-2222-222222222221',
      chatwoot_conversation_id: 101,
      channel: 'whatsapp',
      customer_name: 'Maria de Souza',
      customer_phone: '+5511977776666',
      items: [
        { product_name: 'Dipirona 500mg 20 comp', unit_price: 8.50, quantity: 2 },
        { product_name: 'Dorflex 36 comprimidos', unit_price: 22.50, quantity: 1 },
      ],
      discount: 4.50,
      fulfillment_method: 'delivery',
      origin_type: 'manual',
      delivery_address: 'Av. Paulista, 1000 - Bela Vista',
    };

    const req = new NextRequest('http://localhost:3000/api/sales', {
      method: 'POST',
      body: JSON.stringify(salePayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const data = await res.json();
    // 2 * 8.50 + 22.50 = 17.00 + 22.50 = 39.50
    expect(data.subtotal).toBe(39.50);
    // 39.50 - 4.50 = 35.00
    expect(data.total_amount).toBe(35.00);
    expect(data.status).toBe('confirmed');
    expect(data.items.length).toBe(2);
    expect(data.confirmed_at).toBeDefined();
  });

  it('deve rejeitar payload de venda sem itens com HTTP 400', async () => {
    const invalidPayload = {
      organization_id: '11111111-1111-1111-1111-111111111111',
      branch_id: '22222222-2222-2222-2222-222222222221',
      chatwoot_conversation_id: 101,
      channel: 'whatsapp',
      customer_name: 'Maria',
      items: [], // Vazio!
    };

    const req = new NextRequest('http://localhost:3000/api/sales', {
      method: 'POST',
      body: JSON.stringify(invalidPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_SALE_INPUT');
  });
});
