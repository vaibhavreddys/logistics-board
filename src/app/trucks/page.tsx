'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Trucks(){
  const [rows, setRows] = useState<any[]>([]);
  const [vehicle_number,setVN]=useState('');
  const [vehicle_type,setVT]=useState('');
  const [capacity_kg,setCap]=useState('');

  useEffect(()=>{(async()=>{ const { data } = await supabase.from('trucks').select('*').order('created_at',{ascending:false}); setRows(data||[]); })();},[]);

  const add = async ()=>{
    const { data, error } = await supabase.from('trucks').insert({ vehicle_number, vehicle_type, capacity_kg: Number(capacity_kg)||null, owner_id: (await supabase.auth.getUser()).data.user?.id });
    if(!error){ const { data: d } = await supabase.from('trucks').select('*').order('created_at',{ascending:false}); setRows(d||[]); setVN(''); setVT(''); setCap(''); }
  };

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-4">
      <Card className="p-4 space-y-2">
        <h2 className="font-semibold">Register Truck</h2>
        <div className="grid md:grid-cols-3 gap-2">
          <Input placeholder="KA-01-AB-1234" value={vehicle_number} onChange={e=>setVN(e.target.value)}/>
          <Input placeholder="32ft SXL Container" value={vehicle_type} onChange={e=>setVT(e.target.value)}/>
          <Input placeholder="Capacity (kg)" type="number" value={capacity_kg} onChange={e=>setCap(e.target.value)}/>
        </div>
        <Button onClick={add}>Add Truck</Button>
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        {rows.map(r=> <Card key={r.id} className="p-3">{r.vehicle_number} • {r.vehicle_type} • {r.capacity_kg||'—'} kg</Card>)}
      </div>
    </main>
  );
}