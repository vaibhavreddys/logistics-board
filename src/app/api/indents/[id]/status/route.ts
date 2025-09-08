import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Await the params Promise to resolve the id
  const { id } = await params;
  
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  
  // Use the resolved id instead of params.id
  const { data: indent, error } = await supa.from('indents').update({ status: 'assigned' }).eq('id', id).select().single();
  
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  
  await supa.from('indent_status_history').insert({ 
    indent_id: indent.id, 
    to_status: indent.status, 
    remark: 'server route update' 
  });
  
  return NextResponse.json(indent);
}