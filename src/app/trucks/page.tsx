'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Navbar from '@/components/ui/Navbar';
import { X, Pencil } from 'lucide-react';
import { SpeedInsights } from "@vercel/speed-insights/next"

export default function TrucksPage() {
  const [form, setForm] = useState({
    owner_id: '',
    vehicle_number: '',
    vehicle_type: '',
    capacity_kg: '',
    active: true,
  });
  const [truckOwners, setTruckOwners] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [editingTruckId, setEditingTruckId] = useState<string | null>(null);
  const router = useRouter();
  const formRef = useRef<HTMLDivElement>(null);

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
        const { data: owners, error: ownersError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('role', 'truck_owner');
        if (ownersError) {
          console.error('Error fetching truck owners:', ownersError.message);
          setError('Failed to load truck owners.');
          return;
        }
        setTruckOwners(owners || []);

        const { data: t, error: trucksError } = await supabase
          .from('trucks')
          .select('*, profiles!trucks_owner_id_fkey(full_name)')
          .order('created_at', { ascending: false });
        if (trucksError) {
          console.error('Error fetching trucks:', trucksError.message);
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
    if (!form.owner_id) return 'Please select a truck owner.';
    if (!form.vehicle_number || !/^[A-Z0-9-]+$/.test(form.vehicle_number)) return 'Please enter a valid vehicle number (alphanumeric with hyphens).';
    if (!form.vehicle_type) return 'Please select a vehicle type.';
    if (!form.capacity_kg || Number(form.capacity_kg) <= 0) return 'Please enter a valid capacity (kg).';
    return null;
  };

  const createTruck = async () => {
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
        setError('You must be logged in to create a truck.');
        router.push('/login');
        return;
      }

      const payload = {
        owner_id: form.owner_id,
        vehicle_number: form.vehicle_number,
        vehicle_type: form.vehicle_type,
        capacity_kg: Number(form.capacity_kg),
        active: form.active,
      };

      const { data: truck, error: truckError } = await supabase
        .from('trucks')
        .insert(payload)
        .select('*, profiles!trucks_owner_id_fkey(full_name)')
        .single();
      if (truckError) {
        console.error('Error creating truck:', truckError.message);
        setError(`Failed to create truck: ${truckError.message}`);
        return;
      }

      setTrucks(prev => [truck, ...prev]);
      setForm({
        owner_id: '',
        vehicle_number: '',
        vehicle_type: '',
        capacity_kg: '',
        active: true,
      });
      setEditingTruckId(null);
      setSuccess('Truck created successfully!');
      setTimeout(() => {
        setSuccess(null);
      }, 5000);
    } catch (err) {
      console.error('Unexpected error creating truck:', err);
      setError('An unexpected error occurred while creating the truck.');
    }
  };

  const updateTruck = async () => {
    try {
      setError(null);
      setSuccess(null);

      const validationError = validateForm();
      if (validationError) {
        setError(validationError);
        return;
      }

      if (!editingTruckId) {
        setError('No truck selected for editing.');
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('No authenticated user:', userError?.message);
        setError('You must be logged in to update a truck.');
        router.push('/login');
        return;
      }

      const payload = {
        owner_id: form.owner_id,
        vehicle_number: form.vehicle_number,
        vehicle_type: form.vehicle_type,
        capacity_kg: Number(form.capacity_kg),
        active: form.active,
        updated_at: new Date().toISOString(),
      };

      const { data: truck, error: truckError } = await supabase
        .from('trucks')
        .update(payload)
        .eq('id', editingTruckId)
        .select('*, profiles!trucks_owner_id_fkey(full_name)')
        .single();
      if (truckError) {
        console.error('Error updating truck:', truckError.message);
        setError(`Failed to update truck: ${truckError.message}`);
        return;
      }

      setTrucks(prev =>
        prev.map(t => (t.id === editingTruckId ? truck : t))
      );
      setForm({
        owner_id: '',
        vehicle_number: '',
        vehicle_type: '',
        capacity_kg: '',
        active: true,
      });
      setEditingTruckId(null);
      setSuccess('Truck updated successfully!');
      setTimeout(() => {
        setSuccess(null);
      }, 5000);
    } catch (err) {
      console.error('Unexpected error updating truck:', err);
      setError('An unexpected error occurred while updating the truck.');
    }
  };

  const toggleActiveStatus = async (id: string, currentActive: boolean) => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('No authenticated user:', userError?.message);
        setError('You must be logged in to update truck status.');
        return;
      }

      const { error: updateError } = await supabase
        .from('trucks')
        .update({ active: !currentActive })
        .eq('id', id);
      if (updateError) {
        console.error('Error updating truck status:', updateError.message);
        setError(`Failed to update truck status: ${updateError.message}`);
        return;
      }

      setTrucks(prev =>
        prev.map(t =>
          t.id === id ? { ...t, active: !currentActive } : t
        )
      );
    } catch (err) {
      console.error('Error updating truck status:', err);
      setError('Failed to update truck status. Please try again.');
    }
  };

  const handleEdit = (truck: any) => {
    setForm({
      owner_id: truck.owner_id || '',
      vehicle_number: truck.vehicle_number || '',
      vehicle_type: truck.vehicle_type || '',
      capacity_kg: truck.capacity_kg?.toString() || '',
      active: truck.active,
    });
    setEditingTruckId(truck.id);
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCancelEdit = () => {
    setForm({
      owner_id: '',
      vehicle_number: '',
      vehicle_type: '',
      capacity_kg: '',
      active: true,
    });
    setEditingTruckId(null);
  };

  const filteredTrucks = useMemo(() => {
    const s = q.toLowerCase();
    return trucks.filter(t =>
      [t.vehicle_number, t.vehicle_type, t.profiles?.full_name || ''].some(f => f.toLowerCase().includes(s))
    );
  }, [q, trucks]);

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
        {/* Create/Edit truck form */}
        <Card className="p-4 space-y-3" ref={formRef}>
          <h2 className="text-xl font-bold">{editingTruckId ? 'Editing Truck' : 'Add Truck'}</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Truck Owner</Label>
                <Link href="/truck-owners?returnTo=/trucks" className="text-blue-600 hover:underline text-sm">
                  Missing Owner? Add here
                </Link>
              </div>
              <select
                className="w-full border rounded p-2"
                value={form.owner_id}
                onChange={e => setForm({ ...form, owner_id: e.target.value })}
              >
                <option value="">Select owner</option>
                {truckOwners.map(owner => (
                  <option key={owner.id} value={owner.id}>
                    {owner.full_name || 'Unknown'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Vehicle Number</Label>
              <Input
                value={form.vehicle_number}
                onChange={e => setForm({ ...form, vehicle_number: e.target.value })}
              />
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
              <Label>Capacity (kg)</Label>
              <Input
                type="number"
                value={form.capacity_kg}
                onChange={e => setForm({ ...form, capacity_kg: e.target.value })}
              />
            </div>
            <div>
              <Label>Active</Label>
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => setForm({ ...form, active: e.target.checked })}
                className="ml-2"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={editingTruckId ? updateTruck : createTruck}>
              {editingTruckId ? 'Update Truck' : 'Add Truck'}
            </Button>
            {editingTruckId && (
              <Button variant="outline" onClick={handleCancelEdit}>
                Cancel
              </Button>
            )}
          </div>
        </Card>

        {/* Truck list */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Trucks ({filteredTrucks.length})</h2>
            <Input
              placeholder="Search vehicle number / type / owner"
              value={q}
              onChange={e => setQ(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {filteredTrucks.map(t => (
              <Card key={t.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{t.vehicle_number}</div>
                    <div className="text-sm">Type: {t.vehicle_type}</div>
                    <div className="text-sm">Capacity: {t.capacity_kg} kg</div>
                    <div className="text-sm">
                      Owner: <Link href={`/truck-owners/view/${t.owner_id}`} className="text-blue-600 hover:underline">
                        {t.profiles?.full_name || 'Unknown'}
                      </Link>
                    </div>
                  </div>
                  <div className="text-sm">Status: <b>{t.active ? 'Active' : 'Inactive'}</b></div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant={t.active ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => toggleActiveStatus(t.id, t.active)}
                  >
                    {t.active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(t)}>
                    <Pencil size={16} className="mr-2" /> Edit
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}