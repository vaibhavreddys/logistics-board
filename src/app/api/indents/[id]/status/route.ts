import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function PATCH(_req: NextRequest, { params }: { params: { id: string }}){
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: indent, error } = await supa.from('indents').update({ status: 'assigned' }).eq('id', params.id).select().single();
  if(error) return NextResponse.json({ error: error.message }, { status: 400 });
  await supa.from('indent_status_history').insert({ indent_id: indent.id, to_status: indent.status, remark: 'server route update' });
  return NextResponse.json(indent);
}