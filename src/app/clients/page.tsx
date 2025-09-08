'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Navbar from '@/components/ui/Navbar';
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"

export default function Clients() {
  const [name, setName] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profile?.role !== 'admin') {
        router.push('/');
      }
    };
    checkAuth();

    (async () => {
      const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
      setRows(data || []);
    })();
  }, [router]);

  const add = async () => {
    if (!name) return;
    const { data, error } = await supabase.from('clients').insert({ name }).select().single();
    if (!error) {
      setRows([data, ...rows]);
      setName('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <Card className="p-4 space-y-2">
          <h2 className="font-semibold">Add Client</h2>
          <div className="flex gap-2">
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Client name" />
            <Button onClick={add}>Add</Button>
          </div>
        </Card>
        <div className="space-y-2">
          {rows.map(r => (
            <Card key={r.id} className="p-3">{r.name}</Card>
          ))}
        </div>
      </main>
    </div>
  );
}