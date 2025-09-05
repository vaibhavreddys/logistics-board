'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function DispatchPage(){
  const [form, setForm] = useState({
    client_id:'', origin:'', destination:'', vehicle_type:'', trip_cost:'', tat_hours:'', load_material:'', load_weight_kg:'', pickup_at:'', contact_phone:''
  });
  const [clients,setClients]=useState<any[]>([]);
  const [indents,setIndents]=useState<any[]>([]);
  const [history, setHistory] = useState<Record<string, any[]>>({});

  useEffect(()=>{
    (async()=>{
      const { data: c } = await supabase.from('clients').select('id,name');
      setClients(c||[]);
      const { data: i } = await supabase.from('indents').select('*').order('created_at', { ascending:false });
      setIndents(i||[]);

      // preload history for each indent
      if(i){
        for(const indent of i){
          const { data: h } = await supabase
            .from('indent_status_history')
            .select('*')
            .eq('indent_id', indent.id)
            .order('changed_at', { ascending: false });
          setHistory(prev => ({ ...prev, [indent.id]: h || [] }));
        }
      }
    })();
  },[]);

  const createIndent = async () => {
    const payload:any = { ...form,
      trip_cost: Number(form.trip_cost||0),
      tat_hours: Number(form.tat_hours||0),
      load_weight_kg: form.load_weight_kg? Number(form.load_weight_kg): null,
      pickup_at: new Date(form.pickup_at).toISOString(),
    };
    const { data, error } = await supabase.from('indents').insert(payload).select().single();
    if(!error){ 
      setIndents(prev=>[data, ...prev]); 
      setForm({client_id:'',origin:'',destination:'',vehicle_type:'',trip_cost:'',tat_hours:'',load_material:'',load_weight_kg:'',pickup_at:'',contact_phone:''}); 
    }
  };

  const updateStatus = async (id:string, to_status:string) => {
    await supabase.from('indents').update({ status: to_status }).eq('id', id);
    await supabase.from('indent_status_history').insert({ indent_id:id, to_status, remark:`status → ${to_status}` });

    // fetch updated history
    const { data: h } = await supabase
      .from('indent_status_history')
      .select('*')
      .eq('indent_id', id)
      .order('created_at', { ascending: false });
    
    setHistory(prev => ({ ...prev, [id]: h || [] }));
  };

  return (
    <main className="max-w-6xl mx-auto p-4 space-y-6">
      {/* Create indent form */}
      <Card className="p-4 space-y-3">
        <h2 className="text-xl font-bold">Create Indent</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label>Client</Label>
            <select className="w-full border rounded p-2" value={form.client_id} onChange={e=>setForm({...form, client_id:e.target.value})}>
              <option value="">Select client</option>
              {clients.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><Label>From</Label><Input value={form.origin} onChange={e=>setForm({...form, origin:e.target.value})}/></div>
          <div><Label>To</Label><Input value={form.destination} onChange={e=>setForm({...form, destination:e.target.value})}/></div>
          <div><Label>Vehicle Type</Label><Input value={form.vehicle_type} onChange={e=>setForm({...form, vehicle_type:e.target.value})}/></div>
          <div><Label>Trip Cost (₹)</Label><Input type="number" value={form.trip_cost} onChange={e=>setForm({...form, trip_cost:e.target.value})}/></div>
          <div><Label>TAT (hours)</Label><Input type="number" value={form.tat_hours} onChange={e=>setForm({...form, tat_hours:e.target.value})}/></div>
          <div><Label>Load Material</Label><Input value={form.load_material} onChange={e=>setForm({...form, load_material:e.target.value})}/></div>
          <div><Label>Load Weight (kg)</Label><Input type="number" value={form.load_weight_kg} onChange={e=>setForm({...form, load_weight_kg:e.target.value})}/></div>
          <div><Label>Pickup Date & Time</Label><Input type="datetime-local" value={form.pickup_at} onChange={e=>setForm({...form, pickup_at:e.target.value})}/></div>
          <div><Label>Contact Phone</Label><Input value={form.contact_phone} onChange={e=>setForm({...form, contact_phone:e.target.value})}/></div>
        </div>
        <Button onClick={createIndent}>Post to Load Board</Button>
      </Card>

      {/* My indents */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">My Indents</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {indents.map(i=> (
            <Card key={i.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{i.origin} → {i.destination}</div>
                  <div className="text-sm">{i.vehicle_type} • Pickup {new Date(i.pickup_at).toLocaleString()}</div>
                </div>
                <div className="text-sm">Status: <b>{i.status}</b></div>
              </div>

              {/* Status buttons */}
              <div className="flex gap-2 flex-wrap">
                {['open','assigned','in_transit','delivered','cancelled'].map(s=> (
                  <button 
                    key={s} 
                    className={`px-3 py-1 rounded border ${i.status===s? 'bg-black text-white':''}`} 
                    onClick={()=>updateStatus(i.id, s)}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Status history */}
              <div className="mt-3 space-y-1 text-sm">
                <b>Status History:</b>
                {(history[i.id] || []).map(h => (
                  <div key={h.id} className="text-gray-600">
                    {new Date(h.changed_at).toLocaleString()} — {h.to_status} ({h.remark})
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
