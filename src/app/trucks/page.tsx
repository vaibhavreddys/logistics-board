'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Navbar from '@/components/ui/Navbar';
import { X, Pencil, Plus, ChevronLeft } from 'lucide-react';
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

interface TruckOwner {
  id: string;
  full_name: string;
  preferred_routes: { from: string; to: string }[] | null;
}

interface Indent {
  origin: string;
  destination: string;
}

interface Truck {
  id: string;
  owner_id: string;
  vehicle_number: string;
  vehicle_type: string;
  capacity_kg: number;
  active: boolean;
  profiles: { full_name: string };
}

interface Trip {
  id: string;
  short_id: string;
  truck_id: string;
  status: string;
  origin: string;
  destination: string;
  created_at: string;
  indents: { origin: string, destination: string };
}

export default function TrucksPage() {
  const [form, setForm] = useState({
    owner_id: '',
    vehicle_number: '',
    vehicle_type: '',
    capacity_kg: '',
    active: true,
  });
  const [truckOwners, setTruckOwners] = useState<TruckOwner[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTruckId, setEditingTruckId] = useState<string | null>(null);
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const [isAddTruckFormOpen, setIsAddTruckFormOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [originalTruckData, setOriginalTruckData] = useState<Truck | null>(null);
  const router = useRouter();
  const formRefMobile = useRef<HTMLDivElement | null>(null);
  const formRefDesktop = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          console.log('Auth error or no user:', userError?.message);
          router.push("/login?redirect=/trucks");
          return;
        }
      } catch (err) {
        console.error('Unexpected error in checkAuth:', err);
        setError('An unexpected error occurred. Please try again.');
      }
    };
    checkAuth();

    (async () => {
      try {
        // Fetch truck owners with preferred routes
        const { data: owners, error: ownersError } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            truck_owners!truck_owners_profile_id_fkey(preferred_routes)
          `)
          .eq('role', 'truck_owner');
        if (ownersError) {
          console.error('Error fetching truck owners:', ownersError.message);
          setError('Failed to load truck owners.');
          return;
        }
        setTruckOwners(owners?.map(owner => ({
          ...owner,
          preferred_routes: owner.truck_owners[0]?.preferred_routes || null,
        })) || []);

        // Fetch trucks
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

        // Fetch trips with origin and destination
        const truckIds = t?.map(truck => truck.id) || [];
        const { data: tripsData, error: tripsError } = await supabase
          .from('trips')
          .select(`
            id,
            short_id,
            truck_id,
            status,
            created_at,
            indents!trips_indent_id_fkey(origin, destination)
          `)
          .in('truck_id', truckIds)
          .order('created_at', { ascending: false });
        if (tripsError) {
          console.error('Error fetching trips:', tripsError.message);
          setError('Failed to load trips.');
          return;
        }
        setTrips(tripsData?.map((trip: any) => ({
          ...trip,
          origin: trip.indents?.origin || 'N/A',
          destination: trip.indents?.destination || 'N/A',
          indents: trip.indents || { origin: 'N/A', destination: 'N/A' },
        })) || []);
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
    if (!form.capacity_kg || Number(form.capacity_kg) <= 0) return 'Please enter a valid capacity (MT).';
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
      setIsAddTruckFormOpen(false);
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
      setIsAddTruckFormOpen(false);
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

  const hasFormChanged = () => {
    if (!editingTruckId || !originalTruckData) return true;
    return (
      form.owner_id !== originalTruckData.owner_id ||
      form.vehicle_number !== originalTruckData.vehicle_number ||
      form.vehicle_type !== originalTruckData.vehicle_type ||
      Number(form.capacity_kg) !== originalTruckData.capacity_kg ||
      form.active !== originalTruckData.active
    );
  };

  const handleEdit = (truck: Truck) => {
    setForm({
      owner_id: truck.owner_id || '',
      vehicle_number: truck.vehicle_number || '',
      vehicle_type: truck.vehicle_type || '',
      capacity_kg: truck.capacity_kg?.toString() || '',
      active: truck.active,
    });
    setEditingTruckId(truck.id);
    setIsAddTruckFormOpen(true);
    setSelectedTruck(null);
    setOriginalTruckData(truck);
    setIsSidebarOpen(true);
    setTimeout(() => {
      const formRef = window.innerWidth < 768 ? formRefMobile : formRefDesktop;
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 0);
  };

  const handleCancelEdit = () => {
    setForm({
      owner_id: '',
      vehicle_number: '',
      vehicle_type: '',
      capacity_kg: '',
      active: true,
    });
    setOriginalTruckData(null);
    setEditingTruckId(null);
    setIsAddTruckFormOpen(false);
    setIsSidebarOpen(true);
  };

  const handleAddTruckClick = () => {
    setIsAddTruckFormOpen(true);
    setSelectedTruck(null);
    setIsSidebarOpen(true);
    setTimeout(() => {
      const formRef = window.innerWidth < 768 ? formRefMobile : formRefDesktop;
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 0);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setSelectedTruck(null);
    setIsSidebarOpen(true);
  };

  const filteredTrucks = useMemo(() => {
    const s = searchQuery.toLowerCase();
    return trucks.filter(t => {
      const owner = truckOwners.find(o => o.id === t.owner_id);
      const preferredRoutes = owner?.preferred_routes?.map(r => `${r.from} ${r.to}`.toLowerCase()) || [];
      const truckTrips = trips.filter(trip => trip.truck_id === t.id);
      const tripLocations = truckTrips.map(trip => `${trip.origin} ${trip.destination}`.toLowerCase());
      return (
        t.vehicle_number.toLowerCase().includes(s) ||
        t.vehicle_type.toLowerCase().includes(s) ||
        (t.profiles?.full_name || '').toLowerCase().includes(s) ||
        preferredRoutes.some(route => route.includes(s)) ||
        tripLocations.some(loc => loc.includes(s))
      );
    });
  }, [searchQuery, trucks, truckOwners, trips]);

  const renderAddTruckForm = (ref: React.RefObject<HTMLDivElement | null>, className: string) => (
    isAddTruckFormOpen && (
      <Card className={`p-4 space-y-3 ${className}`} ref={ref}>
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">{editingTruckId ? 'Edit Truck' : 'Add Truck'}</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancelEdit}
          >
            <X size={20} />
          </Button>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label>Truck Owner / Agent</Label>
              <Link href="/truck-owners?returnTo=/trucks" className="text-blue-600 hover:underline text-sm">
                Missing Name? Add here
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
            <Label>Capacity (MT)</Label>
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
          <Button onClick={editingTruckId ? updateTruck : createTruck} disabled={!hasFormChanged() && !!editingTruckId}>
            {editingTruckId ? 'Update Truck' : 'Add Truck'}
          </Button>
          <Button variant="outline" onClick={handleCancelEdit}>
            Cancel
          </Button>
        </div>
      </Card>
    )
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <main className="max-w-7xl mx-auto p-4 space-y-6 flex flex-col md:flex-row">
        {/* Truck List (Sidebar on md screens, collapsible on mobile) */}
        <section
          className={`md:w-1/3 md:pr-4 space-y-3 ${selectedTruck && !isSidebarOpen ? 'hidden md:block' : 'block'}`}
        >
          <div className="flex flex-row items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Trucks ({filteredTrucks.length})</h2>
            <Button
              onClick={handleAddTruckClick}
              className=""
            >
              <Plus size={16} className="mr-2" /> Add New Truck
            </Button>
          </div>
          <Input
            placeholder="Search by number, type, owner, route, or trip"
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            className="max-w-sm w-full"
          />
          {renderAddTruckForm(formRefMobile, 'block md:hidden')}
          <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
            {filteredTrucks.map(t => (
              <Card
                key={t.id}
                className={`p-4 space-y-2 cursor-pointer ${selectedTruck?.id === t.id ? 'bg-blue-100' : ''}`}
                onClick={() => {
                  setIsAddTruckFormOpen(false);
                  setSelectedTruck(t);
                  setIsSidebarOpen(false);
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{t.vehicle_number}</div>
                    <div className="text-sm">Type: {t.vehicle_type}</div>
                    <div className="text-sm">Capacity: {t.capacity_kg} MT</div>
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
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(t);
                    }}
                  >
                    <Pencil size={16} className="mr-2" /> Edit
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Main Content: Trips */}
        <section className="md:w-2/3 md:pl-4 space-y-3">
          {renderAddTruckForm(formRefDesktop, 'hidden md:block min-w-[48rem] max-w-lg mx-auto')}
          {selectedTruck && (
            <>
              <Button
                variant="outline"
                className="w-full max-w-sm"
                onClick={() => {
                  setSelectedTruck(null);
                  setIsSidebarOpen(true);
                }}
              >
                <ChevronLeft size={16} className="mr-2" /> Back to Trucks
              </Button>
              <Card>
                <CardHeader>
                  <h2 className="text-xl font-bold">Trips for {selectedTruck.vehicle_number}</h2>
                </CardHeader>
                <CardContent>
                  {trips.filter(trip => trip.truck_id === selectedTruck.id).length === 0 ? (
                    <p className="text-gray-500">No trips serviced by this truck.</p>
                  ) : (
                    <div className="space-y-3">
                      {trips
                        .filter(trip => trip.truck_id === selectedTruck.id)
                        .map(trip => (
                          <Card key={trip.id} className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-semibold">{trip.short_id}</div>
                                <div className="text-sm">Route: {trip.origin} → {trip.destination}</div>
                                <div className="text-sm">Status: {trip.status}</div>
                                <div className="text-sm">Created: {new Date(trip.created_at).toLocaleDateString()}</div>
                              </div>
                            </div>
                          </Card>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </section>

        {/* Error and Success Messages */}
        {error && (
          <div className="fixed top-4 right-4 bg-red-100 text-red-700 p-3 rounded flex justify-between items-center z-50">
            {error}
            <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900">
              <X size={20} />
            </button>
          </div>
        )}
        {success && (
          <div className="fixed top-4 right-4 bg-green-100 text-green-700 p-3 rounded flex justify-between items-center animate-pulse z-50">
            {success}
            <button onClick={() => setSuccess(null)} className="text-green-700 hover:text-green-900">
              <X size={20} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}