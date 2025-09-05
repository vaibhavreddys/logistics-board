import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest){
  const body = await req.json();
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await supa.from('indents').insert(body).select().single();
  if(error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}