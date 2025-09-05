'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Navbar from '@/components/ui/Navbar';
import { X } from 'lucide-react';

export default function IndentsPage() {
  const [form, setForm] = useState({
    client_id: '',
    origin: '',
    destination: '',
    vehicle_type: '',
    trip_cost: '',
    tat_hours: '',
    load_material: '',
    load_weight_kg: '',
    pickup_at: '',
    contact_phone: '',
  });
  const [clients, setClients] = useState<any[]>([]);
  const [indents, setIndents] = useState<any[]>([]);
  const [history, setHistory] = useState<Record<string, any[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          console.error('Auth error or no user:', userError?.message);
          router.push('/login');
          return;
        }
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (profileError || profile?.role !== 'admin') {
          console.error('Profile fetch error or not admin:', profileError?.message);
          router.push('/');
        }
      } catch (err) {
        console.error('Unexpected error in checkAuth:', err);
        setError('An unexpected error occurred. Please try again.');
      }
    };
    checkAuth();

    (async () => {
      try {
        const { data: c } = await supabase.from('clients').select('id,name');
        setClients(c || []);
        // Fetch indents with admin's full_name and client name via joins
        const { data: i, error: indentError } = await supabase
          .from('indents')
          .select('*, profiles!indents_created_by_fkey(full_name), clients!client_id(name)')
          .order('created_at', { ascending: false });
        if (indentError) {
          console.error('Error fetching indents:', indentError.message);
          setError('Failed to load indents.');
          return;
        }
        setIndents(i || []);

        // Preload history for each indent with updater's full_name
        if (i) {
          for (const indent of i) {
            const { data: h, error: historyError } = await supabase
              .from('indent_status_history')
              .select('*, profiles!indent_status_history_changed_by_fkey(full_name)')
              .eq('indent_id', indent.id)
              .order('changed_at', { ascending: false });
            if (historyError) {
              console.error('Error fetching history for indent:', indent.id, historyError.message);
              setError('Failed to load status history.');
              continue;
            }
            setHistory(prev => ({ ...prev, [indent.id]: h || [] }));
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again.');
      }
    })();
  }, [router]);

  const validateForm = () => {
    if (!form.client_id) return 'Please select a client.';
    if (!form.origin) return 'Please enter an origin.';
    if (!form.destination) return 'Please enter a destination.';
    if (!form.vehicle_type) return 'Please enter a vehicle type.';
    if (!form.trip_cost || Number(form.trip_cost) <= 0) return 'Please enter a valid trip cost.';
    if (!form.tat_hours || Number(form.tat_hours) <= 0) return 'Please enter a valid TAT (hours).';
    if (!form.load_material) return 'Please enter a load material.';
    if (!form.pickup_at) return 'Please select a pickup date and time.';
    if (!form.contact_phone || !/^\d{10}$/.test(form.contact_phone)) return 'Please enter a valid 10-digit contact phone number.';
    return null;
  };

  const createIndent = async () => {
    try {
      setError(null);
      setSuccess(null);

      // Validate form inputs
      const validationError = validateForm();
      if (validationError) {
        setError(validationError);
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('No authenticated user:', userError?.message);
        setError('You must be logged in to create an indent.');
        router.push('/login');
        return;
      }

      const payload: any = {
        ...form,
        created_by: user.id,
        trip_cost: Number(form.trip_cost || 0),
        tat_hours: Number(form.tat_hours || 0),
        load_weight_kg: form.load_weight_kg ? Number(form.load_weight_kg) : null,
        pickup_at: form.pickup_at ? new Date(form.pickup_at).toISOString() : null,
        status: 'open',
      };

      // Insert indent and fetch with admin's full_name and client name
      const { data: indent, error: indentError } = await supabase
        .from('indents')
        .insert(payload)
        .select('*, profiles!indents_created_by_fkey(full_name), clients!client_id(name)')
        .single();
      if (indentError) {
        console.error('Error creating indent:', indentError.message);
        setError(`Failed to create indent: ${indentError.message}`);
        return;
      }

      // Insert initial status history
      const { error: historyError } = await supabase
        .from('indent_status_history')
        .insert({
          indent_id: indent.id,
          to_status: 'open',
          changed_by: user.id,
          remark: 'Indent created',
        });

      if (historyError) {
        console.error('Error creating status history:', historyError.message);
        setError(`Failed to record status history: ${historyError.message}`);
        return;
      }

      // Update indents and history state
      setIndents(prev => [indent, ...prev]);
      setHistory(prev => ({
        ...prev,
        [indent.id]: [{ id: indent.id, to_status: 'open', changed_by: user.id, remark: 'Indent created', changed_at: new Date().toISOString() }],
      }));
      setForm({
        client_id: '',
        origin: '',
        destination: '',
        vehicle_type: '',
        trip_cost: '',
        tat_hours: '',
        load_material: '',
        load_weight_kg: '',
        pickup_at: '',
        contact_phone: '',
      });
      console.log('Setting success message: Indent created successfully!');
      setSuccess('Indent created successfully!');
      // Auto-dismiss success message after 5 seconds
      setTimeout(() => {
        console.log('Clearing success message');
        setSuccess(null);
      }, 5000);
    } catch (err) {
      console.error('Unexpected error creating indent:', err);
      setError('An unexpected error occurred while creating the indent.');
    }
  };

  const updateStatus = async (id: string, to_status: string) => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('No authenticated user:', userError?.message);
        setError('You must be logged in to update indent status.');
        return;
      }

      // Find the current indent
      const currentIndent = indents.find(i => i.id === id);
      if (!currentIndent) {
        console.error('Indent not found:', id);
        setError('Indent not found.');
        return;
      }

      // Skip if the status is the same
      if (currentIndent.status === to_status) {
        console.log('Status unchanged, skipping update:', to_status);
        return;
      }

      const { error: updateError } = await supabase.from('indents').update({ status: to_status }).eq('id', id);
      if (updateError) {
        console.error('Error updating indent status:', updateError.message);
        setError(`Failed to update indent status: ${updateError.message}`);
        return;
      }

      const { error: historyError } = await supabase
        .from('indent_status_history')
        .insert({
          indent_id: id,
          to_status,
          changed_by: user.id,
          remark: `status → ${to_status}`,
        });

      if (historyError) {
        console.error('Error updating status history:', historyError.message);
        setError(`Failed to record status history: ${historyError.message}`);
        return;
      }

      // Fetch updated history with updater's full_name
      const { data: h, error: fetchError } = await supabase
        .from('indent_status_history')
        .select('*, profiles!indent_status_history_changed_by_fkey(full_name)')
        .eq('indent_id', id)
        .order('changed_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching updated history:', fetchError.message);
        setError(`Failed to fetch status history: ${fetchError.message}`);
        return;
      }

      // Update indents state with new status
      setIndents(prev =>
        prev.map(i =>
          i.id === id ? { ...i, status: to_status } : i
        )
      );
      setHistory(prev => ({ ...prev, [id]: h || [] }));
    } catch (err) {
      console.error('Error updating status:', err);
      setError('Failed to update indent status. Please try again.');
    }
  };

  // Helper function to format status for display
  const formatStatus = (status: string, remark: string) => {
    if (status === 'open' && remark === 'Indent created') return 'Created';
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Filter indents based on search query
  const filteredIndents = useMemo(() => {
    const s = q.toLowerCase();
    return indents.filter(i =>
      [i.origin, i.destination, i.vehicle_type, i.clients?.name || ''].some(t => t.toLowerCase().includes(s))
    );
  }, [q, indents]);

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <main className="max-w-6xl mx-auto p-4 space-y-6">
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4 flex justify-between items-center">
            {error}
            <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900">
              <X size={20} />
            </button>
          </div>
        )}
        {success && (
          <div className="bg-green-100 text-green-700 p-3 rounded mb-4 flex justify-between items-center animate-pulse z-50">
            {success}
            <button onClick={() => setSuccess(null)} className="text-green-700 hover:text-green-900">
              <X size={20} />
            </button>
          </div>
        )}
        {/* Create indent form */}
        <Card className="p-4 space-y-3">
          <h2 className="text-xl font-bold">Create Indent</h2>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Client</Label>
              <select
                className="w-full border rounded p-2"
                value={form.client_id}
                onChange={e => setForm({ ...form, client_id: e.target.value })}
              >
                <option value="">Select client</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>From</Label>
              <Input value={form.origin} onChange={e => setForm({ ...form, origin: e.target.value })} />
            </div>
            <div>
              <Label>To</Label>
              <Input value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} />
            </div>
            <div>
              <Label>Vehicle Type</Label>
              <Input value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })} />
            </div>
            <div>
              <Label>Trip Cost (₹)</Label>
              <Input
                type="number"
                value={form.trip_cost}
                onChange={e => setForm({ ...form, trip_cost: e.target.value })}
              />
            </div>
            <div>
              <Label>TAT (hours)</Label>
              <Input
                type="number"
                value={form.tat_hours}
                onChange={e => setForm({ ...form, tat_hours: e.target.value })}
              />
            </div>
            <div>
              <Label>Load Material</Label>
              <Input value={form.load_material} onChange={e => setForm({ ...form, load_material: e.target.value })} />
            </div>
            <div>
              <Label>Load Weight (kg)</Label>
              <Input
                type="number"
                value={form.load_weight_kg}
                onChange={e => setForm({ ...form, load_weight_kg: e.target.value })}
              />
            </div>
            <div>
              <Label>Pickup Date & Time</Label>
              <Input
                type="datetime-local"
                value={form.pickup_at}
                onChange={e => setForm({ ...form, pickup_at: e.target.value })}
              />
            </div>
            <div>
              <Label>Contact Phone</Label>
              <Input
                type="text"
                value={form.contact_phone}
                onChange={e => setForm({ ...form, contact_phone: e.target.value })}
              />
            </div>
          </div>
          <Button onClick={createIndent}>Post to Load Board</Button>
        </Card>

        {/* My indents */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h2 className="text-xl font-bold">My Indents ({filteredIndents.length})</h2>
            <Input
              placeholder="Search city / vehicle / client"
              value={q}
              onChange={e => setQ(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {filteredIndents.map(i => (
              <Card key={i.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{i.origin} → {i.destination}</div>
                    <div className="text-sm">Client: {i.clients?.name || 'Unknown Client'}</div>
                    <div className="text-sm">{i.vehicle_type} • Pickup {new Date(i.pickup_at).toLocaleString()}</div>
                  </div>
                  <div className="text-sm">Created by: <b>{i.profiles?.full_name || 'Unknown'}</b></div>
                </div>

                {/* Status buttons */}
                <div className="flex gap-2 flex-wrap">
                  {['open', 'assigned', 'in_transit', 'delivered', 'cancelled'].map(s => (
                    <button
                      key={s}
                      className={`px-3 py-1 rounded border ${
                        i.status === s ? 'bg-black text-white' : 'bg-white text-black'
                      } ${i.status === s ? 'cursor-not-allowed' : 'hover:bg-gray-200'}`}
                      onClick={() => updateStatus(i.id, s)}
                      disabled={i.status === s}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {/* Status history */}
                <div className="mt-3 space-y-1 text-sm">
                  <b>Status History:</b>
                  {(history[i.id] || []).map((h, index) => (
                    <div key={h.id} className={`text-gray-600 ${index === 0 ? 'font-bold' : ''}`}>
                      {new Date(h.changed_at).toLocaleString()} — {formatStatus(h.to_status, h.remark)} by {h.profiles?.full_name || 'Unknown'}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}