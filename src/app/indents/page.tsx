'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Navbar from '@/components/ui/Navbar';
import { X, Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"; // Assuming you use a UI library like shadcn for Dialog

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
  const [editingIndentId, setEditingIndentId] = useState<string | null>(null);
  const [statusFilters, setStatusFilters] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('indentStatusFilters');
      return saved ? JSON.parse(saved) : {
        open: true,
        confirmation: true,
        vehicle_placed: true,
        completed: true,
        pending: true,
        cancelled: true,
        failed: true,
      };
    }
    return {
      open: true,
      confirmation: true,
      vehicle_placed: true,
      completed: true,
      pending: true,
      cancelled: true,
      failed: true,
    };
  });
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedIndentId, setSelectedIndentId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [comments, setComments] = useState('');
  const router = useRouter();
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('indentStatusFilters', JSON.stringify(statusFilters));
    }
  }, [statusFilters]);

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
    if (!form.vehicle_type) return 'Please select a vehicle type.';
    if (!form.pickup_at) return 'Please select a placement date and time.';
    if (!form.contact_phone || !/^\d{10}$/.test(form.contact_phone)) return 'Please enter a valid 10-digit contact phone number.';
    return null;
  };

  const createIndent = async () => {
    setLoading(true);
    try {
      setError(null);
      setSuccess(null);

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
      setEditingIndentId(null);
      setSuccess('Indent created successfully!');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Unexpected error creating indent:', err);
      setError('An unexpected error occurred while creating the indent.');
    } finally {
      setLoading(false);
    }
  };

  const updateIndent = async () => {
    setLoading(true);
    try {
      setError(null);
      setSuccess(null);

      const validationError = validateForm();
      if (validationError) {
        setError(validationError);
        return;
      }

      if (!editingIndentId) {
        setError('No indent selected for editing.');
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('No authenticated user:', userError?.message);
        setError('You must be logged in to update an indent.');
        router.push('/login');
        return;
      }

      const payload: any = {
        client_id: form.client_id,
        origin: form.origin,
        destination: form.destination,
        vehicle_type: form.vehicle_type,
        trip_cost: Number(form.trip_cost || 0),
        tat_hours: Number(form.tat_hours || 0),
        load_material: form.load_material,
        load_weight_kg: form.load_weight_kg ? Number(form.load_weight_kg) : null,
        pickup_at: form.pickup_at ? new Date(form.pickup_at).toISOString() : null,
        contact_phone: form.contact_phone,
        updated_at: new Date().toISOString(),
      };

      const { data: indent, error: indentError } = await supabase
        .from('indents')
        .update(payload)
        .eq('id', editingIndentId)
        .select('*, profiles!indents_created_by_fkey(full_name), clients!client_id(name)')
        .single();
      if (indentError) {
        console.error('Error updating indent:', indentError.message);
        setError(`Failed to update indent: ${indentError.message}`);
        return;
      }

      setIndents(prev => prev.map(i => (i.id === editingIndentId ? indent : i)));
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
      setEditingIndentId(null);
      setSuccess('Indent updated successfully!');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Unexpected error updating indent:', err);
      setError('An unexpected error occurred while updating the indent.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (indent: any) => {
    setForm({
      client_id: indent.client_id || '',
      origin: indent.origin || '',
      destination: indent.destination || '',
      vehicle_type: indent.vehicle_type || '',
      trip_cost: indent.trip_cost?.toString() || '',
      tat_hours: indent.tat_hours?.toString() || '',
      load_material: indent.load_material || '',
      load_weight_kg: indent.load_weight_kg?.toString() || '',
      pickup_at: indent.pickup_at ? new Date(indent.pickup_at).toISOString().slice(0, 16) : '',
      contact_phone: indent.contact_phone || '',
    });
    setEditingIndentId(indent.id);
    if (formRef.current) formRef.current.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
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
    setEditingIndentId(null);
  };

  const toggleStatusFilter = (status: string) => {
    setStatusFilters(prev => ({ ...prev, [status]: !prev[status] }));
  };

  const formatStatus = (status: string, remark: string) => {
    if (status === 'open' && remark === 'Indent created') return 'Created';
    return status
      .split(/(?=[A-Z])|_/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const validateStatusUpdate = () => {
    if (!newStatus) return 'Please select a status.';
    if (['vehicle_placed', 'completed', 'pending', 'cancelled', 'failed'].includes(newStatus)) {
      if (!vehicleNumber) return 'Please enter a vehicle number.';
      const normalizedVehicleNumber = vehicleNumber.toUpperCase();
      if (!/^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}$/.test(normalizedVehicleNumber)) {
        return 'Please enter a valid Indian vehicle number (e.g., KA01AB1234).';
      }
      if (!driverPhone || !/^\d{10}$/.test(driverPhone)) {
        return 'Please enter a valid 10-digit driver phone number.';
      }
    }
    return null;
  };

  const updateStatus = async () => {
    setLoading(true);
    try {
      const validationError = validateStatusUpdate();
      if (validationError) {
        setError(validationError);
        return;
      }
      setError(null);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('No authenticated user:', userError?.message);
        setError('You must be logged in to update indent status.');
        return;
      }

      const currentIndent = indents.find(i => i.id === selectedIndentId);
      if (!currentIndent) {
        console.error('Indent not found:', selectedIndentId);
        setError('Indent not found.');
        return;
      }

      if (currentIndent.status === newStatus) {
        console.log('Status unchanged, skipping update:', newStatus);
        setStatusModalOpen(false);
        return;
      }

      const payload: any = { status: newStatus };
      if (['vehicle_placed', 'completed', 'pending', 'cancelled', 'failed'].includes(newStatus)) {
        payload.vehicle_number = vehicleNumber.toUpperCase();
        payload.driver_phone = driverPhone;
      }

      const { error: updateError } = await supabase.from('indents').update(payload).eq('id', selectedIndentId);
      if (updateError) {
        console.error('Error updating indent status:', updateError.message);
        setError(`Failed to update indent status: ${updateError.message}`);
        return;
      }

      const remark = `status → ${newStatus}${vehicleNumber ? `, Vehicle: ${vehicleNumber}` : ''}${driverPhone ? `, Driver Phone: ${driverPhone}` : ''}${comments ? `, Comments: ${comments}` : ''}`;
      const { error: historyError } = await supabase
        .from('indent_status_history')
        .insert({
          indent_id: selectedIndentId,
          to_status: newStatus,
          changed_by: user.id,
          remark: remark,
        });

      if (historyError) {
        console.error('Error updating status history:', historyError.message);
        setError(`Failed to record status history: ${historyError.message}`);
        return;
      }

      const { data: h, error: fetchError } = await supabase
        .from('indent_status_history')
        .select('*, profiles!indent_status_history_changed_by_fkey(full_name)')
        .eq('indent_id', selectedIndentId)
        .order('changed_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching updated history:', fetchError.message);
        setError(`Failed to fetch status history: ${fetchError.message}`);
        return;
      }

      setIndents(prev => prev.map(i => i.id === selectedIndentId ? { ...i, ...payload, status: newStatus } : i));
      setHistory(prev => ({ ...prev, [selectedIndentId]: h || [] }));
      setSuccess('Status updated successfully!');
      setTimeout(() => setSuccess(null), 5000);
      setStatusModalOpen(false);
      setNewStatus('');
      setVehicleNumber('');
      setDriverPhone('');
      setComments('');
    } catch (err) {
      console.error('Error updating status:', err);
      setError('Failed to update indent status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredIndents = useMemo(() => {
    const s = q.toLowerCase();
    return indents.filter(i =>
      statusFilters[i.status] &&
      [i.origin, i.destination, i.vehicle_type, i.clients?.name || ''].some(t => t.toLowerCase().includes(s))
    );
  }, [q, indents, statusFilters]);

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
        <Card className="p-4 space-y-3" ref={formRef}>
          <h2 className="text-xl font-bold">{editingIndentId ? 'Editing Indent' : 'Create Indent'}</h2>
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
              <select
                className="w-full border rounded p-2"
                value={form.vehicle_type}
                onChange={e => setForm({ ...form, vehicle_type: e.target.value })}
              >
                <option value="">Select vehicle type</option>
                <option value="32 ft MXL">32 ft MXL (Multi Axle)</option>
                <option value="32 ft SXL">32 ft SXL (Single Axle)</option>
                <option value="24 ft Truck">24 ft Truck</option>
                <option value="20 ft Truck">20 ft Truck</option>
                <option value="22 ft Truck">22 ft Truck</option>
                <option value="17 ft Truck">17 ft Truck</option>
                <option value="14 ft Truck">14 ft Truck</option>
                <option value="10 ft (407)">10 ft Truck / Tata 407</option>
                <option value="8 ft (Bolero)">8 ft Pickup (Bolero / Pickup)</option>
                <option value="7 ft TataAce">7 ft Tata Ace</option>
              </select>
            </div>
            <div>
              <Label>Load Weight (MT)</Label>
              <Input
                type="number"
                value={form.load_weight_kg}
                onChange={e => setForm({ ...form, load_weight_kg: e.target.value })}
              />
            </div>
            <div>
              <Label>Load Material</Label>
              <Input value={form.load_material} onChange={e => setForm({ ...form, load_material: e.target.value })} />
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
              <Label>Placement Date & Time</Label>
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
          <div className="flex gap-2">
            <Button onClick={editingIndentId ? updateIndent : createIndent} disabled={loading}>
              {loading ? 'Processing...' : (editingIndentId ? 'Update Indent' : 'Post to Load Board')}
            </Button>
            {editingIndentId && (
              <Button variant="outline" onClick={handleCancelEdit}>
                Cancel
              </Button>
            )}
          </div>
        </Card>

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
          {isClient && (
            <div className="flex flex-wrap gap-2">
              {['open', 'confirmation', 'vehicle_placed', 'completed', 'pending', 'cancelled', 'failed'].map(status => (
                <Button
                  key={status}
                  variant={statusFilters[status] ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleStatusFilter(status)}
                >
                  {formatStatus(status, '')}
                </Button>
              ))}
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-3">
            {filteredIndents.map(i => (
              <Card key={i.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{i.origin} → {i.destination}</div>
                    <div className="text-sm">Client: {i.clients?.name || 'Unknown Client'}</div>
                    <div className="text-sm">{i.vehicle_type} • Pickup {new Date(i.pickup_at).toLocaleString()}</div>
                    {i.vehicle_number && <div className="text-sm">Vehicle: {i.vehicle_number}</div>}
                    {i.driver_phone && <div className="text-sm">Driver Phone: {i.driver_phone}</div>}
                  </div>
                  <div className="text-sm">Created by: <b>{i.profiles?.full_name || 'Unknown'}</b></div>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Status:</Label>
                  <span className="border rounded p-2">{formatStatus(i.status, '')}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedIndentId(i.id);
                      setNewStatus(i.status);
                      setVehicleNumber(i.vehicle_number || '');
                      setDriverPhone(i.driver_phone || '');
                      setComments('');
                      setStatusModalOpen(true);
                    }}
                    disabled={loading}
                  >
                    Update Status
                  </Button>
                </div>

                <div className="mt-3 space-y-1 text-sm">
                  <b>Status History:</b>
                  {(history[i.id] || []).map((h, index) => (
                    <div key={h.id} className={`text-gray-600 ${index === 0 ? 'font-bold' : ''}`}>
                      {new Date(h.changed_at).toLocaleString()} — {formatStatus(h.to_status, h.remark)} by {h.profiles?.full_name || 'Unknown'}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(i)}>
                    <Pencil size={16} className="mr-2" /> Edit
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Indent Status</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>New Status</Label>
                <select
                  className="w-full border rounded p-2"
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                  disabled={loading}
                >
                  {['open', 'confirmation', 'vehicle_placed', 'completed', 'pending', 'cancelled', 'failed'].map(status => (
                    <option key={status} value={status} disabled={indents.find(i => i.id === selectedIndentId)?.status === status}>
                      {formatStatus(status, '')}
                    </option>
                  ))}
                </select>
              </div>
              {['vehicle_placed', 'completed', 'pending', 'cancelled', 'failed'].includes(newStatus) && (
                <>
                  <div>
                    <Label>Vehicle Number</Label>
                    <Input
                      value={vehicleNumber}
                      onChange={e => setVehicleNumber(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <Label>Driver Phone</Label>
                    <Input
                      type="text"
                      value={driverPhone}
                      onChange={e => setDriverPhone(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </>
              )}
              <div>
                <Label>Comments (Optional)</Label>
                <Input
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  disabled={loading}
                  placeholder="Add any comments..."
                />
              </div>
              {error && <div className="text-red-700">{error}</div>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setStatusModalOpen(false); setError(null);}} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={updateStatus} disabled={loading}>
                {loading ? 'Processing...' : 'Update'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}