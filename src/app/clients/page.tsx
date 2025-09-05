'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Clients(){
  const [name, setName] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  useEffect(()=>{(async()=>{ const { data } = await supabase.from('clients').select('*').order('created_at',{ascending:false}); setRows(data||[]); })();},[]);
  const add = async ()=>{
    if(!name) return;
    const { data, error } = await supabase.from('clients').insert({ name }).select().single();
    if(!error) { setRows([data, ...rows]); setName(''); }
  };
  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <Card className="p-4 space-y-2">
        <h2 className="font-semibold">Add Client</h2>
        <div className="flex gap-2">
          <Input value={name} onChange={e=>setName(e.target.value)} placeholder="Client name"/>
          <Button onClick={add}>Add</Button>
        </div>
      </Card>
      <div className="space-y-2">
        {rows.map(r=> <Card key={r.id} className="p-3">{r.name}</Card>)}
      </div>
    </main>
  );
}