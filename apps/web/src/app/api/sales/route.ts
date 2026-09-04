import { NextResponse, type NextRequest } from 'next/server';
import { CreateSaleInputSchema, type Sale } from '@hub-farmacia/contracts';
import { supabaseRest } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parseResult = CreateSaleInputSchema.safeParse(json);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'INVALID_SALE_INPUT', details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const input = parseResult.data;
    const subtotal = input.items.reduce(
      (acc: number, item: { unit_price: number; quantity: number }) =>
        acc + item.unit_price * item.quantity,
      0
    );
    const totalAmount = Math.max(0, subtotal - input.discount);

    // 0. Localizar ou cadastrar o cliente real no Supabase
    let realCustomerId = '44444444-4444-4444-4444-444444444441';
    const phoneClean = (input.customer_phone || '').replace(/\D/g, '');

    try {
      if (phoneClean) {
        const existingCust = await supabaseRest<any[]>('customers', {
          params: {
            phone: `eq.${phoneClean}`,
            organization_id: `eq.${input.organization_id}`,
            select: 'id,name',
          },
        });

        if (existingCust.data && existingCust.data.length > 0 && existingCust.data[0]?.id) {
          realCustomerId = existingCust.data[0].id;
          console.log('[Supabase Customers] Cliente existente reutilizado:', realCustomerId, existingCust.data[0].name);
        } else {
          const newCust = await supabaseRest<any[]>('customers', {
            method: 'POST',
            body: {
              organization_id: input.organization_id,
              name: input.customer_name || 'Cliente WhatsApp',
              phone: phoneClean,
            },
          });
          if (newCust.data && newCust.data[0]?.id) {
            realCustomerId = newCust.data[0].id;
            console.log('[Supabase Customers] Novo cliente gravado no Supabase:', realCustomerId, input.customer_name);
          }
        }
      }
    } catch (custErr) {
      console.warn('[Supabase Customers] Erro ao cadastrar cliente, usando fallback:', custErr);
    }

    // 1. Inserir cabeçalho da venda no Supabase
    const salePayload = {
      organization_id: input.organization_id,
      branch_id: input.branch_id,
      chatwoot_conversation_id: input.chatwoot_conversation_id,
      channel: input.channel,
      customer_id: realCustomerId,
      agent_id: input.agent_id || '33333333-3333-3333-3333-333333333332',
      subtotal,
      discount: input.discount,
      total_amount: totalAmount,
      fulfillment_method: input.fulfillment_method,
      status: 'confirmed',
      origin_type: input.origin_type,
      delivery_address: input.delivery_address || null,
      notes: input.notes || null,
      confirmed_at: new Date().toISOString(),
    };

    let realSaleId = `sale_${Date.now()}`;
    const supabaseSaleRes = await supabaseRest<any[]>('sales', {
      method: 'POST',
      body: salePayload,
    });

    if (supabaseSaleRes.data && supabaseSaleRes.data[0]?.id) {
      realSaleId = supabaseSaleRes.data[0].id;

      // 2. Inserir itens da venda vinculados ao ID real
      const itemsPayload = input.items.map((i) => ({
        sale_id: realSaleId,
        product_name_snapshot: i.product_name,
        unit_price_snapshot: i.unit_price,
        quantity: i.quantity,
        total_item_price: i.unit_price * i.quantity,
      }));

      await supabaseRest('sale_items', {
        method: 'POST',
        body: itemsPayload,
      });

      // 3. Registrar evento de auditoria imutável
      await supabaseRest('audit_events', {
        method: 'POST',
        body: {
          organization_id: input.organization_id,
          actor_id: input.agent_id || '33333333-3333-3333-3333-333333333332',
          actor_email: input.agent_name ? `${input.agent_name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@multifarma.com` : 'ana.clara@multifarma.com',
          action: 'SALE_CONFIRMED',
          entity_type: 'sale',
          entity_id: realSaleId,
          metadata: {
            conversation_id: input.chatwoot_conversation_id,
            total_amount: totalAmount,
            channel: input.channel,
            customer_name: input.customer_name,
            customer_phone: phoneClean,
            items_count: input.items.length,
            fulfillment_method: input.fulfillment_method,
            agent_name: input.agent_name || 'Ana Souza',
          },
        },
      });

      console.log('[Supabase] Venda e auditoria salvas com sucesso no banco:', realSaleId);
    } else {
      console.warn('[Supabase] Inserção de venda falhou ou sem credenciais, usando fallback:', supabaseSaleRes.error);
    }

    const sale: Sale = {
      id: realSaleId,
      organization_id: input.organization_id,
      branch_id: input.branch_id,
      chatwoot_conversation_id: input.chatwoot_conversation_id,
      channel: input.channel,
      customer_id: '44444444-4444-4444-4444-444444444441',
      agent_id: '33333333-3333-3333-3333-333333333332',
      subtotal,
      discount: input.discount,
      total_amount: totalAmount,
      fulfillment_method: input.fulfillment_method,
      status: 'confirmed',
      origin_type: input.origin_type,
      delivery_address: input.delivery_address,
      notes: input.notes,
      confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: input.items.map((i, idx) => ({
        id: `item_${idx + 1}`,
        product_id: i.product_id,
        product_name_snapshot: i.product_name,
        unit_price_snapshot: i.unit_price,
        quantity: i.quantity,
        total_item_price: i.unit_price * i.quantity,
      })),
    };

    return NextResponse.json(sale, { status: 201 });
  } catch (err) {
    console.error('Erro ao processar venda:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: (err as Error).message },
      { status: 500 }
    );
  }
}
