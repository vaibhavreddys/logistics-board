'use client';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Phone } from 'lucide-react';

interface Indent {
  id: string; client_id: string; origin: string; destination: string; vehicle_type: string; trip_cost: number; tat_hours: number; load_material: string | null; load_weight_kg: number | null; pickup_at: string; contact_phone: string; status: string; created_at: string; updated_at: string;
}

export default function LoadBoard(){
  const [indents, setIndents] = useState<Indent[]>([]);
  const [q, setQ] = useState('');

  useEffect(()=>{
    const fetchData = async ()=>{
      const { data } = await supabase.from('indents').select('*').order('pickup_at');
      setIndents(data || []);
    };
    fetchData();

    const channel = supabase
      .channel('indents-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'indents' }, (payload)=>{
        setIndents(prev=>{
          const next = [...prev];
          const row = payload.new as Indent;
          const idx = next.findIndex(i=>i.id===row.id);
          if(idx>-1) next[idx]=row; else next.unshift(row);
          return [...next];
        });
      })
      .subscribe();

    return ()=>{ supabase.removeChannel(channel); };
  },[]);

  const filtered = useMemo(()=>{
    const s = q.toLowerCase();
    return indents.filter(i=> [i.origin, i.destination, i.vehicle_type, i.load_material||''].some(t => t.toLowerCase().includes(s)));
  }, [q, indents]);

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Open Loads</h1>
        <Input placeholder="Search city / vehicle / material" value={q} onChange={e=>setQ(e.target.value)} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((i)=> (
          <Card key={i.id} className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{i.origin} → {i.destination}</h2>
              <Badge variant={i.status==='open' ? 'default' : 'secondary'}>{i.status}</Badge>
            </div>
            <p className="text-sm">Vehicle: {i.vehicle_type} • TAT: {i.tat_hours}h • Pickup: {new Date(i.pickup_at).toLocaleString()}</p>
            <p className="text-sm">Load: {i.load_material || '—'} • {i.load_weight_kg ? `${i.load_weight_kg} kg` : ''}</p>
            <p className="font-medium">Trip Cost: ₹{Number(i.trip_cost).toLocaleString()}</p>
            <a className="inline-flex items-center gap-2 text-blue-600 hover:underline" href={`tel:${i.contact_phone}`}>
              <Phone size={16}/> Contact: {i.contact_phone}
            </a>
          </Card>
        ))}
      </div>
    </main>
  );
}