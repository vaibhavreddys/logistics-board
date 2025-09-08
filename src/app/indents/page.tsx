'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Navbar from '@/components/ui/Navbar';
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"

import { X, Pencil, History, Truck, Package, Phone, Calendar, Handshake, MessageSquareText, User, Edit } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function IndentsPage() {
  const [form, setForm] = useState({
    client_id: '',
    origin: '',
    destination: '',
    vehicle_type: '',
    trip_cost: '',
    client_cost: '',
    tat_hours: '',
    load_material: '',
    load_weight_kg: '',
    pickup_at: '',
    contact_phone: '',
  });
  const [clients, setClients] = useState<any[]>([]);
  const [indents, setIndents] = useState<any[]>([]);
  const [history, setHistory] = useState<Record<string, any[]>>({});
  const [trucks, setTrucks] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [editingIndentId, setEditingIndentId] = useState<string | null>(null);
  const [statusFilters, setStatusFilters] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('indentStatusFilters');
      return saved ? JSON.parse(saved) : {
        open: true,
        accepted: true,
        cancelled: true,
      };
    }
    return {
      open: true,
      accepted: true,
      cancelled: true,
    };
  });
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [commentsModalOpen, setCommentsModalOpen] = useState(false);
  const [selectedIndentId, setSelectedIndentId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [comments, setComments] = useState('');
  const [isNewStatusSelected, setIsNewStatusSelected] = useState(false);
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
          console.log('Auth error or no user:', userError?.message);
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
          .select('*, profiles!indents_created_by_fkey(full_name), clients!client_id(name), short_id')
          .order('created_at', { ascending: false });
        if (indentError) {
          console.error('Error fetching indents:', indentError.message);
          setError('Failed to load indents.');
          return;
        }
        setIndents(i || []);
        const { data: t, error: truckError } = await supabase
          .from('trucks')
          .select('vehicle_number')
          .eq('active', true)
          .order('vehicle_number', { ascending: true });
        if (truckError) {
          console.error('Error fetching trucks:', truckError.message);
          setError('Failed to load trucks.');
          return;
        }
        setTrucks(t || []);
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
    if (!form.client_cost && !form.trip_cost) return 'Please enter either Client Cost or Trip Cost.';
    return null;
  };

  const generateShortId = async (origin: string, destination: string) => {
    const prefix = `${origin.charAt(0)}${destination.charAt(0)}`.toUpperCase();
    const { data: existingIndents, error: countError } = await supabase
      .from('indents')
      .select('short_id')
      .ilike('short_id', `${prefix}%`);
    if (countError) {
      console.error('Error counting existing indents:', countError.message);
      return `${prefix}0001`; // Fallback to 0001 if count fails
    }
    const maxNumber = existingIndents.reduce((max, indent) => {
      const num = parseInt(indent.short_id?.slice(2) || '0');
      return num > max ? num : max;
    }, 0);
    const nextNumber = String(maxNumber + 1).padStart(4, '0');
    return `${prefix}${nextNumber}`;
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

      const shortId = await generateShortId(form.origin, form.destination);
      const payload: any = {
        ...form,
        created_by: user.id,
        trip_cost: Number(form.trip_cost || 0),
        client_cost: Number(form.client_cost || 0),
        tat_hours: Number(form.tat_hours || 0),
        load_weight_kg: form.load_weight_kg ? Number(form.load_weight_kg) : null,
        pickup_at: form.pickup_at ? new Date(form.pickup_at).toISOString() : null,
        status: 'open',
        short_id: shortId, // Add short_id to payload
      };

      const { data: indent, error: indentError } = await supabase
        .from('indents')
        .insert(payload)
        .select('*, profiles!indents_created_by_fkey(full_name), clients!client_id(name), short_id')
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
        client_cost: '',
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
        client_cost: Number(form.client_cost || 0),
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
        .select('*, profiles!indents_created_by_fkey(full_name), clients!client_id(name), short_id')
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
        client_cost: '',
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
      client_cost: indent.client_cost?.toString() || '',
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
      client_cost: '',
      tat_hours: '',
      load_material: '',
      load_weight_kg: '',
      pickup_at: '',
      contact_phone: '',
    });
    setEditingIndentId(null);
  };

  const toggleStatusFilter = (status: string) => {
    setStatusFilters((prev: Record<string, boolean>) => ({ ...prev, [status]: !prev[status] }));
  };

  const formatStatus = (status: string, remark: string) => {
    if (status === 'open' && remark === 'Indent created') return 'Created';
    return status.charAt(0).toUpperCase() + status.slice(1);
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

      const payload: any = { 
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (newStatus === 'accepted' && vehicleNumber && driverPhone) {
        payload.vehicle_number = vehicleNumber;
        payload.driver_phone = driverPhone;
        // Create trip with client_cost and short_id
        const { data: trip, error: tripError } = await supabase
          .from('trips')
          .insert({ indent_id: selectedIndentId, client_cost: currentIndent.client_cost, short_id: currentIndent.short_id })
          .select('id')
          .single();
        if (tripError) {
          console.error('Error creating trip:', tripError.message);
          setError(`Failed to create trip: ${tripError.message}`);
          return;
        }
        payload.trip_id = trip.id;
      }
      if (comments) {
        payload.notes = comments;
      }

      const { error: updateError } = await supabase.from('indents').update(payload).eq('id', selectedIndentId);
      if (updateError) {
        console.error('Error updating indent status:', updateError.message);
        setError(`Failed to update indent status: ${updateError.message}`);
        return;
      }

      const remark = `status --> ${newStatus}${vehicleNumber ? `, Vehicle: ${vehicleNumber}` : ''}${driverPhone ? `, Driver Phone: ${driverPhone}` : ''}${comments ? `, Comments: ${comments}` : ''}`;
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

      const { data: updatedIndent } = await supabase
        .from('indents')
        .select('*, profiles!indents_created_by_fkey(full_name), clients!client_id(name), short_id')
        .eq('id', selectedIndentId)
        .single();

      setIndents(prev => prev.map(i => i.id === selectedIndentId ? updatedIndent : i));
      setHistory(prev => {
        if (selectedIndentId) {
          return { ...prev, [selectedIndentId]: h || [] };
        }
        return prev;
      });
      setSuccess('Status updated successfully!');
      setTimeout(() => setSuccess(null), 5000);
      setStatusModalOpen(false);
      setNewStatus('');
      setVehicleNumber('');
      setDriverPhone('');
      setComments('');
      setIsNewStatusSelected(false);
    } catch (err) {
      console.error('Error updating status:', err);
      setError('Failed to update indent status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateComments = async () => {
    setLoading(true);
    try {
      setError(null);
      setSuccess(null);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('No authenticated user:', userError?.message);
        setError('You must be logged in to update comments.');
        return;
      }

      const currentIndent = indents.find(i => i.id === selectedIndentId);
      if (!currentIndent) {
        console.error('Indent not found:', selectedIndentId);
        setError('Indent not found.');
        return;
      }

      const payload: any = {
        notes: comments,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase.from('indents').update(payload).eq('id', selectedIndentId);
      if (updateError) {
        console.error('Error updating comments:', updateError.message);
        setError(`Failed to update comments: ${updateError.message}`);
        return;
      }

      const { data: updatedIndent } = await supabase
        .from('indents')
        .select('*, profiles!indents_created_by_fkey(full_name), clients!client_id(name), short_id')
        .eq('id', selectedIndentId)
        .single();

      setIndents(prev => prev.map(i => i.id === selectedIndentId ? updatedIndent : i));
      setSuccess('Comments updated successfully!');
      setTimeout(() => setSuccess(null), 5000);
      setCommentsModalOpen(false);
      setComments('');
    } catch (err) {
      console.error('Error updating comments:', err);
      setError('Failed to update comments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (indentId: string) => {
    setLoading(true);
    try {
      const { data: h, error: historyError } = await supabase
        .from('indent_status_history')
        .select('*, profiles!indent_status_history_changed_by_fkey(full_name)')
        .eq('indent_id', indentId)
        .order('changed_at', { ascending: false });
      if (historyError) {
        console.error('Error fetching history:', historyError.message);
        setError('Failed to load status history.');
        return;
      }
      setHistory(prev => ({ ...prev, [indentId]: h || [] }));
      setSelectedIndentId(indentId);
      setHistoryModalOpen(true);
    } catch (err) {
      console.error('Error fetching history:', err);
      setError('Failed to load status history. Please try again.');
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

  const validateStatusUpdate = () => {
    if (!newStatus) return 'Please select a status.';
    if (newStatus === 'accepted') {
      if (!vehicleNumber) return 'Please select a vehicle number.';
      if (!trucks.some(t => t.vehicle_number === vehicleNumber)) {
        return 'Selected vehicle number is not available.';
      }
      if (!driverPhone || !/^\d{10}$/.test(driverPhone)) {
        return 'Please enter a valid 10-digit driver phone number.';
      }
    }
    return null;
  };

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
              <Label>Client Cost (₹)</Label>
              <Input
                type="number"
                value={form.client_cost}
                onChange={e => setForm({ ...form, client_cost: e.target.value })}
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
              {['open', 'accepted', 'cancelled'].map(status => (
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
              <Card
                key={i.id}
                className="p-4 bg-white shadow-md hover:shadow-lg transition-shadow flex flex-col h-full">
                <div className="space-y-2 flex-grow">
                  {/* Title with Short ID */}
                  <div className="font-semibold text-lg text-gray-800">
                    {i.origin} ⮕ {i.destination} <span className="text-sm text-gray-500">(ID: {i.short_id})</span>
                  </div>

                  {/* Key-Value rows */}
                  <div className="border rounded-lg divide-y text-sm overflow-hidden">
                    {(i.vehicle_number || i.vehicle_type) && (
                      <div className="grid grid-cols-[auto,1fr] gap-x-2 px-3 py-2 hover:bg-gray-50 transition-colors items-center">
                        <div className="flex items-center text-gray-600 font-medium">
                          <Truck size={16} className="mr-2 text-gray-400" />
                          Vehicle
                        </div>
                        <div className="text-gray-800 font-semibold text-right break-words whitespace-pre-wrap">
                          {i.vehicle_number} {i.vehicle_type}
                        </div>
                      </div>
                    )}

                    {(i.load_weight_kg || i.load_material) && (
                      <div className="grid grid-cols-[auto,1fr] gap-x-2 px-3 py-2 hover:bg-gray-50 transition-colors items-center">
                        <div className="flex items-center text-gray-600 font-medium">
                          <Package size={16} className="mr-2 text-gray-400" />
                          Load
                        </div>
                        <div className="text-gray-800 font-semibold text-right break-words whitespace-pre-wrap">
                          {i.load_weight_kg} MT {i?.load_material}
                        </div>
                      </div>
                    )}

                    {i.driver_phone && (
                      <div className="grid grid-cols-[auto,1fr] gap-x-2 px-3 py-2 hover:bg-gray-50 transition-colors items-center">
                        <div className="flex items-center text-gray-600 font-medium">
                          <Phone size={16} className="mr-2 text-gray-400" />
                          Driver Phone
                        </div>
                        <div className="text-gray-800 font-semibold text-right break-words whitespace-pre-wrap">
                          {i.driver_phone}
                        </div>
                      </div>
                    )}

                    {i.pickup_at && (
                      <div className="grid grid-cols-[auto,1fr] gap-x-2 px-3 py-2 hover:bg-gray-50 transition-colors items-center">
                        <div className="flex items-center text-gray-600 font-medium">
                          <Calendar size={16} className="mr-2 text-gray-400" />
                          Placement At
                        </div>
                        <div className="text-gray-800 font-semibold text-right break-words whitespace-pre-wrap">
                          {new Date(i.pickup_at).toLocaleString()}
                        </div>
                      </div>
                    )}

                    {i.clients?.name && (
                      <div className="grid grid-cols-[auto,1fr] gap-x-2 px-3 py-2 hover:bg-gray-50 transition-colors items-center">
                        <div className="flex items-center text-gray-600 font-medium">
                          <User size={16} className="mr-2 text-gray-400" />
                          Client
                        </div>
                        <div className="text-gray-800 font-semibold text-right break-words whitespace-pre-wrap">
                          {i.clients.name}
                        </div>
                      </div>
                    )}

                    {i.trip_cost > 0 && (
                      <div className="grid grid-cols-[auto,1fr] gap-x-2 px-3 py-2 hover:bg-gray-50 transition-colors items-center">
                        <div className="flex items-center text-gray-600 font-medium">
                          <Handshake size={16} className="mr-2 text-gray-400" />
                          Trip Cost
                        </div>
                        <div className="text-gray-800 font-semibold text-right break-words whitespace-pre-wrap">
                          ₹{i.trip_cost}
                        </div>
                      </div>
                    )}

                    {i.client_cost > 0 && (
                      <div className="grid grid-cols-[auto,1fr] gap-x-2 px-3 py-2 hover:bg-gray-50 transition-colors items-center">
                        <div className="flex items-center text-gray-600 font-medium">
                          <Handshake size={16} className="mr-2 text-gray-400" />
                          Client Cost
                        </div>
                        <div className="text-gray-800 font-semibold text-right break-words whitespace-pre-wrap">
                          ₹{i.client_cost}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Full-width Comments row with edit icon */}
                  {i.notes && (
                    <div className="border rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start text-gray-600 font-small mb-1">
                        <MessageSquareText size={16} className="mr-2 mt-1 text-gray-400" />
                        Comments
                        <button
                          onClick={() => {
                            setSelectedIndentId(i.id);
                            setComments(i.notes || "");
                            setCommentsModalOpen(true);
                          }}
                          className="ml-2 mt-1 text-yellow-600 hover:text-yellow-800 focus:outline-none"
                          disabled={loading}
                        >
                          <Edit size={16} />
                        </button>
                      </div>
                      <div className="text-gray-800 font-semibold break-words whitespace-pre-wrap">
                        {i.notes}
                      </div>
                    </div>
                  )}
                </div>

                {/* Buttons + Status fixed at bottom */}
                <div className="mt-auto pt-4 flex justify-between items-end">
                  <div className="flex gap-3">
                    {i.status !== 'accepted' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-blue-600 border-blue-600 hover:bg-blue-50"
                        onClick={() => {
                          setSelectedIndentId(i.id);
                          setNewStatus(i.status);
                          setVehicleNumber(i.vehicle_number || "");
                          setDriverPhone(i.driver_phone || "");
                          setComments(i.notes || "");
                          setStatusModalOpen(true);
                          setIsNewStatusSelected(false);
                        }}
                      >
                        <span className="flex items-center">
                          <span className="hidden sm:inline">Update</span> Status
                        </span>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-green-600 border-green-600 hover:bg-green-50"
                      onClick={() => fetchHistory(i.id)}
                      disabled={loading}
                    >
                      <span className="flex items-center">
                        <History size={16} className="mr-1" />
                        <span className="hidden sm:inline">View</span> History
                      </span>
                    </Button>
                    {i.status !== 'accepted' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-purple-600 border-purple-600 hover:bg-purple-50"
                        onClick={() => handleEdit(i)}
                      >
                        <span className="flex items-center">
                          <Pencil size={16} className="mr-1" />
                          <span className="hidden sm:inline">Edit</span>
                        </span>
                      </Button>
                    )}
                  </div>
                  <span className="px-2 py-0.5 bg-blue-200 text-blue-900 rounded-lg text-lg font-semibold shadow-md">
                    {formatStatus(i.status, "")}
                  </span>
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
                  onChange={(e) => {
                    setNewStatus(e.target.value);
                    setVehicleNumber('');
                    setDriverPhone('');
                    setIsNewStatusSelected(e.target.value !== (indents.find(i => i.id === selectedIndentId)?.status || ''));
                  }}
                  disabled={loading}
                >
                  {['open', 'accepted', 'cancelled'].map(status => (
                    <option key={status} value={status} disabled={indents.find(i => i.id === selectedIndentId)?.status === status}>
                      {formatStatus(status, '')}
                    </option>
                  ))}
                </select>
              </div>
              {newStatus === 'accepted' && (
                <>
                  <div>
                    <Label>Vehicle Number</Label>
                    <select
                      className="w-full border rounded p-2"
                      value={vehicleNumber}
                      onChange={e => setVehicleNumber(e.target.value)}
                      disabled={loading}
                    >
                      <option value="">Select vehicle number</option>
                      {trucks.map(t => (
                        <option key={t.vehicle_number} value={t.vehicle_number}>
                          {t.vehicle_number}
                        </option>
                      ))}
                    </select>
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
                  disabled={loading || !isNewStatusSelected}
                  placeholder="Add any comments..."
                />
              </div>
              {error && <div className="text-red-700">{error}</div>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setStatusModalOpen(false); setError(null);}} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={updateStatus} disabled={loading || !isNewStatusSelected}>
                {loading ? 'Processing...' : 'Update'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={commentsModalOpen} onOpenChange={setCommentsModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Comments</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Comments</Label>
                <Input
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  disabled={loading}
                  placeholder="Enter comments..."
                />
              </div>
              {error && <div className="text-red-700">{error}</div>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCommentsModalOpen(false); setError(null); setComments(''); }} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={updateComments} disabled={loading}>
                {loading ? 'Processing...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Status History</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {(history[selectedIndentId || ''] || []).map((h, index) => (
                <div key={h.id} className={`p-2 rounded ${index === 0 ? 'bg-gray-100 font-bold' : 'bg-white'}`}>
                  <div className="text-sm text-gray-600">
                    {new Date(h.changed_at).toLocaleString()} — {formatStatus(h.to_status, h.remark)} by {h.profiles?.full_name || 'Unknown'}
                  </div>
                </div>
              ))}
              {(!history[selectedIndentId || ''] || history[selectedIndentId || ''].length === 0) && (
                <div className="text-center text-gray-500">No history available.</div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setHistoryModalOpen(false)} disabled={loading}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}