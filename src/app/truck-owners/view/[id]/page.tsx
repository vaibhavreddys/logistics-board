'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Navbar from '@/components/ui/Navbar';
import { User, CreditCard, Phone, X } from 'lucide-react';

interface TruckOwner {
  id: string;
  full_name: string | null;
  phone: string | null;
  aadhaar_or_pan: string;
  bank_account_number: string | null;
  bank_ifsc_code: string | null;
  upi_id: string | null;
  town_city: string | null;
}

interface Truck {
  id: string;
  vehicle_number: string;
  vehicle_type: string;
  capacity_kg: number;
  active: boolean;
}

export default function TruckOwnerViewPage() {
  const [truckOwner, setTruckOwner] = useState<TruckOwner | null>(null);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { id } = useParams();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('Checking auth...');
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        console.log('Auth response:', { user, userError });
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
        console.log('Profile response:', { profile, profileError });
        if (profileError || profile?.role !== 'admin') {
          console.error('Profile fetch error:', profileError?.message, 'Role:', profile?.role);
          router.push('/');
          return;
        }

        // Fetch specific truck owner details
        const { data: ownerData, error: ownerError } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            phone,
            truck_owners (
              aadhaar_or_pan,
              bank_account_number,
              bank_ifsc_code,
              upi_id,
              town_city
            )
          `)
          .eq('id', id)
          .single();
        if (ownerError || !ownerData) {
          console.error('Error fetching owner:', ownerError?.message);
          setError('Failed to load owner details.');
          return;
        } else {
          console.log(ownerData);
        }

        // Check if truck_owners data exists
        const truckOwnersData = ownerData.truck_owners || {};
        setTruckOwner({
          id: ownerData.id,
          full_name: ownerData.full_name || 'Unknown',
          phone: ownerData.phone || null,
          aadhaar_or_pan: truckOwnersData[0].aadhaar_or_pan || 'Not provided',
          bank_account_number: truckOwnersData[0].bank_account_number || null,
          bank_ifsc_code: truckOwnersData[0].bank_ifsc_code || null,
          upi_id: truckOwnersData[0].upi_id || null,
          town_city: truckOwnersData[0].town_city || null,
        });

        // Fetch trucks for this owner
        const { data: truckData, error: truckError } = await supabase
          .from('trucks')
          .select('*')
          .eq('owner_id', id);
        if (truckError) {
          console.error('Error fetching trucks:', truckError.message);
          setError('Failed to load owner trucks.');
          return;
        }
        setTrucks(truckData || []);
      } catch (err) {
        console.error('Unexpected error in checkAuth:', err);
        setError((err as any)?.message || 'An unexpected error occurred. Please try again.');
      }
    };
    checkAuth();
  }, [router, id]);

  const filteredTrucks = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return trucks.filter(truck =>
      [truck.vehicle_number, truck.vehicle_type].some(field => field?.toLowerCase().includes(query))
    );
  }, [trucks, searchQuery]);

  const handleCloseForm = () => {
    router.push('/trucks');
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
        {truckOwner && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle><h2 className="text-xl font-bold" >Owner Profile</h2></CardTitle>
              <Button variant="ghost" onClick={handleCloseForm}>
                <X size={20} />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      id="full_name"
                      value={truckOwner.full_name || ''}
                      className="pl-10"
                      disabled
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      id="phone"
                      value={truckOwner.phone || ''}
                      className="pl-10"
                      disabled
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="town_city">Town/City</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      id="town_city"
                      value={truckOwner.town_city || ''}
                      className="pl-10"
                      disabled
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aadhaar_or_pan">Aadhaar or PAN</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      id="aadhaar_or_pan"
                      value={truckOwner.aadhaar_or_pan}
                      className="pl-10"
                      disabled
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_account_number">Bank Account Number</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      id="bank_account_number"
                      value={truckOwner.bank_account_number || ''}
                      className="pl-10"
                      disabled
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_ifsc_code">Bank IFSC Code</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      id="bank_ifsc_code"
                      value={truckOwner.bank_ifsc_code || ''}
                      className="pl-10"
                      disabled
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="upi_id">UPI ID</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      id="upi_id"
                      value={truckOwner.upi_id || ''}
                      className="pl-10"
                      disabled
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Owner Trucks ({filteredTrucks.length})</h2>
            <Input
              placeholder="Search vehicle number or type"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {filteredTrucks.map((truck) => (
              <Card key={truck.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{truck.vehicle_number}</div>
                    <div className="text-sm">Type: {truck.vehicle_type}</div>
                    <div className="text-sm">Capacity: {truck.capacity_kg} kg</div>
                  </div>
                  <div className="text-sm">Status: <b>{truck.active ? 'Active' : 'Inactive'}</b></div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}