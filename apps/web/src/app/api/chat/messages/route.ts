import { NextResponse, type NextRequest } from 'next/server';
import { supabaseRest } from '@/lib/supabase';

const ROOM_IDS: Record<string, string> = {
  geral: '77777777-7777-7777-7777-777777777771',
  jardins: '77777777-7777-7777-7777-777777777772',
};

const USER_MAP: Record<string, { name: string; role: string }> = {
  '33333333-3333-3333-3333-333333333331': { name: 'Carlos Mendes', role: 'manager' },
  '33333333-3333-3333-3333-333333333332': { name: 'Ana Souza', role: 'agent' },
  '33333333-3333-3333-3333-333333333333': { name: 'Bruno Lima', role: 'agent' },
  '33333333-3333-3333-3333-333333333334': { name: 'Carla Prado', role: 'agent' },
  '33333333-3333-3333-3333-333333333335': { name: 'Marcos Tech', role: 'admin' },
};

// GET /api/chat/messages?room=geral|jardins
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomKey = (searchParams.get('room') || 'geral').toLowerCase();
    const roomId = ROOM_IDS[roomKey] || ROOM_IDS.geral;

    const res = await supabaseRest<any[]>('internal_messages', {
      params: {
        room_id: `eq.${roomId}`,
        select: 'id,room_id,sender_id,content,created_at',
        order: 'created_at.asc',
        limit: '100',
      },
    });

    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      const formatted = res.data.map((m) => {
        const user = USER_MAP[m.sender_id] || { name: 'Atendente', role: 'agent' };
        const time = new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return {
          id: m.id,
          sender: user.name,
          role: user.role,
          content: m.content,
          time,
          sender_id: m.sender_id,
          created_at: m.created_at,
        };
      });

      return NextResponse.json({ messages: formatted }, { status: 200 });
    }

    // Retorno fallback caso não haja mensagens cadastradas
    return NextResponse.json({
      messages: [
        {
          id: 'welcome_1',
          sender: 'Carlos Mendes',
          role: 'manager',
          content: 'Boas-vindas à equipe no canal interno da farmácia!',
          time: '08:00',
          sender_id: '33333333-3333-3333-3333-333333333331',
          created_at: new Date().toISOString(),
        }
      ]
    }, { status: 200 });
  } catch (err) {
    console.error('Erro ao buscar mensagens do chat:', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: (err as Error).message }, { status: 500 });
  }
}

// POST /api/chat/messages
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const roomKey = (body.room || 'geral').toLowerCase();
    const roomId = ROOM_IDS[roomKey] || ROOM_IDS.geral;
    const content = (body.content || '').trim();

    if (!content) {
      return NextResponse.json({ error: 'EMPTY_MESSAGE' }, { status: 400 });
    }

    const senderId = body.sender_id || '33333333-3333-3333-3333-333333333332'; // Ana Souza default

    const insertRes = await supabaseRest<any[]>('internal_messages', {
      method: 'POST',
      body: {
        room_id: roomId,
        sender_id: senderId,
        content,
      },
    });

    const user = USER_MAP[senderId] || { name: 'Atendente', role: 'agent' };
    const newMsg = {
      id: insertRes.data?.[0]?.id || `msg_${Date.now()}`,
      sender: user.name,
      role: user.role,
      content,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      sender_id: senderId,
      created_at: new Date().toISOString(),
    };

    return NextResponse.json({ message: newMsg }, { status: 201 });
  } catch (err) {
    console.error('Erro ao enviar mensagem no chat:', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: (err as Error).message }, { status: 500 });
  }
}
