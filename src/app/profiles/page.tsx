'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Navbar from '@/components/ui/Navbar';
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { Users, Truck, Route, FileText, Search, Bell, UserCircle, UserRound, ChevronLeft, Menu } from 'lucide-react';

interface Profile {
  id: string;
  full_name: string;
  phone: string;
  role: string;
  created_at: string;
}

interface TruckOwnerDetails {
  aadhaar_or_pan: string;
  bank_account_number: string | null;
  bank_ifsc_code: string | null;
  upi_id: string | null;
  town_city: string | null;
}

interface TruckOwner extends Profile {
  truck_owners: TruckOwnerDetails[]; // Nested object for relation
  aadhaar_or_pan: string;
  bank_account_number: string | null;
  bank_ifsc_code: string | null;
  upi_id: string | null;
  town_city: string | null;
}

interface Truck {
  id: string;
  owner_id: string;
  vehicle_number: string;
  vehicle_type: string;
  capacity_kg: number | null;
  active: boolean;
  created_at: string;
}

interface Trip {
  id: string;
  indent_id: string;
  truck_id: string | null;
  status: string;
  start_time: string | null;
  end_time: string | null;
  current_location: string | null;
  created_at: string;
  short_id: string;
  origin: string;
  destination: string;
}

export default function ProfilesPage() {
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
  const [truckOwners, setTruckOwners] = useState<TruckOwner[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOwner, setSelectedOwner] = useState<TruckOwner | null>(null);
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Default to open on mobile
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Fetch admin profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (profileError || profileData.role !== 'admin') {
        router.push('/');
        return;
      }
      setAdminProfile(profileData);

      // Fetch all truck owners (role = 'truck_owner') with nested truck_owners relation
      const { data: ownersData, error: ownersError } = await supabase
        .from('profiles')
        .select(`
          *,
          truck_owners!truck_owners_profile_id_fkey (
            aadhaar_or_pan,
            bank_account_number,
            bank_ifsc_code,
            upi_id,
            town_city
          )
        `)
        .in('role', ['truck_owner', 'truck_agent'])
        .order('full_name', { ascending: true });
      console.log('Fetched profiles:', ownersData, 'Count:', ownersData?.length || 0); // Debug log
      console.log('Profile roles:', ownersData?.map(p => ({ id: p.id, full_name: p.full_name, role: p.role }))); // Debug log
      if (ownersError) console.error('Error fetching truck owners:', ownersError);
      const formattedOwners = ownersData?.map(owner => ({
        ...owner,
        truck_owners: owner.role === 'truck_owner' ? (owner.truck_owners || {}) : {},
      })) || [];
      console.log('Formatted owners for state:', formattedOwners.map(o => ({
        id: o.id,
        full_name: o.full_name,
        role: o.role,
        truck_owners: o.truck_owners
      }))); // Debug log
      setTruckOwners(formattedOwners);

      // Fetch trucks owned by all truck owners
      const ownerIds = ownersData?.map(o => o.id) || [];
      const { data: trucksData, error: trucksError } = await supabase
        .from('trucks')
        .select('*')
        .in('owner_id', ownerIds);
      console.log('Fetched trucksData:', trucksData); // Debug log for trucks data
      if (trucksError) console.error('Error fetching trucks:', trucksError);
      setTrucks(trucksData || []);

      // Fetch trips serviced by these trucks
      const truckIds = trucksData?.map(t => t.id) || [];
      const { data: tripsData, error: tripsError } = await supabase
        .from('trips')
        .select(`
          *,
          indents!trips_indent_id_fkey (
            origin,
            destination
          )
        `)
        .in('truck_id', truckIds)
        .order('created_at', { ascending: false });
      console.log('Fetched tripsData:', tripsData); // Debug log for trips data
      if (tripsError) console.error('Error fetching trips:', tripsError);
      setTrips(tripsData || []);

      setLoading(false);
    };

    fetchData();
  }, [router]);

  // Set default "My Profile" view on laptop screens
  useEffect(() => {
    const handleResize = () => {
      if (window.matchMedia('(min-width: 768px)').matches) {
        setSelectedOwner(null);
        setSelectedTruck(null);
        setSelectedTrip(null);
      }
    };
    handleResize(); // Run on mount
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const filteredOwners = truckOwners.filter(owner =>
    owner.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    owner.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (owner.truck_owners?.town_city || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getOwnerTrucks = (ownerId: string) => trucks.filter(t => t.owner_id === ownerId);
  const getTruckTrips = (truckId: string) => trips.filter(t => t.truck_id === truckId);
  const getTripTruck = (trip: Trip) => trucks.find(t => t.id === trip.truck_id);
  const getTripOwner = (trip: Trip) => truckOwners.find(o => getOwnerTrucks(o.id).some(t => t.id === trip.truck_id));

  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;

  console.log('Current selectedOwner:', selectedOwner); // Debug log for selected owner
  console.log('Current isSidebarOpen:', isSidebarOpen); // Debug log for sidebar state

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Navbar />
      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`bg-gray-100 p-4 overflow-y-auto transition-all duration-300 fixed md:relative z-50 ${
            isSidebarOpen
              ? 'w-screen h-screen md:w-80 md:h-[calc(100vh-64px)]'
              : 'w-0 h-0 md:w-80 md:h-[calc(100vh-64px)] -ml-64 md:ml-0'
          }`}
        >
          <div className="mb-4">
            <h2 className="text-lg font-semibold mb-2 flex items-center">
              <Users className="mr-2" size={20} />
              Vehicle Providers ({truckOwners.length})
            </h2>
            <Input
              placeholder="Search vehicle providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <ul className="space-y-2">
            <li
              className={`p-2 rounded cursor-pointer hover:bg-gray-200 ${!selectedOwner && !selectedTruck && !selectedTrip ? 'bg-blue-100' : ''}`}
              onClick={() => {
                setSelectedOwner(null);
                setSelectedTruck(null);
                setSelectedTrip(null);
                setIsSidebarOpen(false);
                // console.log('Selected provider:', { id: owner.id, full_name: owner.full_name, role: owner.role });
              }}
            >
              <div className="flex items-center">
                <UserRound className="mr-2" size={16} />
                My Profile
              </div>
            </li>
            {filteredOwners.map(owner => (
              <li
                key={owner.id}
                className={`p-2 rounded cursor-pointer hover:bg-gray-200 ${selectedOwner?.id === owner.id && !selectedTruck && !selectedTrip ? 'bg-blue-100' : ''}`}
                onClick={() => {
                  console.log("Setting owner")
                  console.log(owner)
                  setSelectedOwner(owner);
                  setSelectedTruck(null);
                  setSelectedTrip(null);
                  setIsSidebarOpen(false);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {owner.role === 'truck_owner' ? (
                      <Truck className="mr-2" size={16} />
                    ) : (
                      <UserCircle className="mr-2" size={16} />
                    )}
                    {owner.full_name}
                  </div>
                  <Badge variant="secondary" 
                    className={`ml-2 text-xs hover:bg-black-200 ${owner.role === 'truck_owner' ? 'bg-blue-500' : 'bg-green-500'} text-white`}
                  >
                    {getOwnerTrucks(owner.id).length} 🚚
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* Overlay for mobile sidebar */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Hamburger Menu for Mobile */}
        {!isSidebarOpen && (
          <div className="md:hidden fixed top-16 left-4 z-50">
            <Button
              variant="outline"
              className="bg-white border-gray-300 text-gray-900 hover:bg-gray-100"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={20} />
            </Button>
          </div>
        )}

        {/* Main Content */}
        <main className={`flex-1 p-6 ${isSidebarOpen ? 'md:ml-80' : 'ml-0'}`}>
          {isSidebarOpen && (
            <div className="md:hidden fixed top-0 left-0 w-full h-12 bg-white z-50 flex items-center justify-between px-4">
              <Button
                variant="ghost"
                className="text-gray-600 hover:text-gray-900"
                onClick={() => setIsSidebarOpen(false)}
              >
                <ChevronLeft size={24} />
              </Button>
              <h1 className="text-lg font-semibold">Profiles Overview</h1>
              <div className="w-8" />
            </div>
          )}

          {!isSidebarOpen && !selectedOwner && !selectedTruck && !selectedTrip && (
            <Card className="bg-white">
              <CardHeader>
                <h2 className="text-xl font-semibold">My Profile</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <p><strong>Name:</strong> {adminProfile?.full_name || 'N/A'}</p>
                <p><strong>Phone:</strong> {adminProfile?.phone || 'N/A'}</p>
                <p><strong>Role:</strong> {adminProfile?.role || 'N/A'}</p>
                <p><strong>Joined:</strong> {new Date(adminProfile?.created_at || '').toLocaleDateString()}</p>
              </CardContent>
                <CardFooter className="pt-4">
                  <a
                    href="/truck-owners?returnTo=/profiles"
                    className="w-full"
                  >
                    <button className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition">
                      Onboard Vehicle Provider
                    </button>
                  </a>
                </CardFooter>
            </Card>
          )}

          {!isSidebarOpen && selectedOwner && !selectedTruck && !selectedTrip && (
            <div>
              <Button
                variant="outline"
                className="mb-4 bg-white border-gray-300 text-gray-900 hover:bg-gray-100"
                onClick={() => {
                  if (window.matchMedia('(min-width: 768px)').matches) {
                    setSelectedOwner(null);
                    setSelectedTruck(null);
                    setSelectedTrip(null);
                    setIsSidebarOpen(false);
                  } else {
                    setIsSidebarOpen(true);
                  }
                }}
              >
                <ChevronLeft size={16} className="mr-2" />
                Back
              </Button>
              <div>
                <div className="flex items-center mb-4">
                  <h2 className="text-xl font-semibold">{selectedOwner.full_name}</h2>
                </div>

                <Card className="bg-white mb-6">
                  {/* <CardHeader>
                    <h3 className="text-lg font-medium">Profile Details</h3>
                  </CardHeader> */}
                  <CardContent className="mt-4 space-y-4">
                    <p><strong>Role:</strong> {selectedOwner.role === 'truck_owner' ? 'Truck Owner' : 'Truck Agent'}</p>
                    <p><strong>Phone:</strong> {selectedOwner.phone}</p>
                    <p><strong>Aadhar / PAN:</strong> {selectedOwner.role === 'truck_owner' ? (selectedOwner.truck_owners[0]?.aadhaar_or_pan || 'N/A') : 'N/A'}</p>
                    <p><strong>City:</strong> {selectedOwner.role === 'truck_owner' ? (selectedOwner?.truck_owners[0]?.town_city || 'N/A') : 'N/A'}</p>
                    {selectedOwner?.truck_owners[0]?.bank_account_number && (<p><strong>Account Number:</strong> {selectedOwner?.truck_owners[0]?.bank_account_number}</p>)}
                    {selectedOwner?.truck_owners[0]?.bank_ifsc_code && (<p><strong>IFSC Number:</strong> {selectedOwner?.truck_owners[0]?.bank_ifsc_code}</p>)}
                    {selectedOwner?.truck_owners[0]?.upi_id && (<p><strong>UPI ID:</strong> {selectedOwner?.truck_owners[0]?.upi_id}</p>)}
                    <p><strong>Joined:</strong> {new Date(selectedOwner.created_at).toLocaleDateString()}</p>
                  </CardContent>
                </Card>

                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="bg-white">
                    <CardHeader>
                      <h3 className="text-lg font-medium flex items-center">
                        <Truck size={20} className="mr-2" />
                        Trucks ({getOwnerTrucks(selectedOwner.id).length})
                      </h3>
                    </CardHeader>
                    <CardContent>
                      {getOwnerTrucks(selectedOwner.id).length === 0 ? (
                        <p className="text-gray-500">No trucks registered.</p>
                      ) : (
                        <ul className="space-y-2">
                          {getOwnerTrucks(selectedOwner.id).map(truck => (
                            <li
                              key={truck.id}
                              className="p-3 border rounded-lg hover:bg-gray-100 cursor-pointer"
                              onClick={() => {
                                setSelectedTruck(truck);
                                setSelectedTrip(null);
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">{truck.vehicle_number}</p>
                                  <p className="text-sm text-gray-500">{truck.vehicle_type}</p>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  {truck.active ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-white">
                    <CardHeader>
                      <h3 className="text-lg font-medium flex items-center">
                        <Route size={20} className="mr-2" />
                        Trips ({getTruckTrips(getOwnerTrucks(selectedOwner.id).map(t => t.id).join(',')).length})
                      </h3>
                    </CardHeader>
                    <CardContent>
                      {getTruckTrips(getOwnerTrucks(selectedOwner.id).map(t => t.id).join(',')).length === 0 ? (
                        <p className="text-gray-500">No trips serviced.</p>
                      ) : (
                        <ul className="space-y-2">
                          {getTruckTrips(getOwnerTrucks(selectedOwner.id).map(t => t.id).join(',')).map(trip => (
                            <li
                              key={trip.id}
                              className="p-3 border rounded-lg hover:bg-gray-100 cursor-pointer"
                              onClick={() => {
                                setSelectedTrip(trip);
                                setSelectedTruck(selectedTruck);
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">{trip.short_id}</p>
                                  <p className="text-sm text-gray-500">{trip.origin} → {trip.destination}</p>
                                </div>
                                <Badge variant={trip.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                                  {trip.status}
                                </Badge>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {selectedTruck && !selectedTrip && (
            <div>
              <Button
                variant="outline"
                className="mb-4 bg-white border-gray-300 text-gray-900 hover:bg-gray-100"
                onClick={() => {
                  setSelectedTruck(null);
                  setSelectedTrip(null);
                }}
              >
                <ChevronLeft size={16} className="mr-2" />
                Back to Owner
              </Button>
              <Card className="bg-white mb-6">
                <CardHeader>
                  <h2 className="text-xl font-semibold">Truck Details</h2>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p><strong>Number:</strong> {selectedTruck.vehicle_number}</p>
                  <p><strong>Type:</strong> {selectedTruck.vehicle_type}</p>
                  <p><strong>Capacity:</strong> {selectedTruck.capacity_kg || 'N/A'} kg</p>
                  <p><strong>Active:</strong> {selectedTruck.active ? 'Yes' : 'No'}</p>
                  <p><strong>Owner:</strong> {truckOwners.find(o => o.id === selectedTruck.owner_id)?.full_name || 'N/A'}</p>
                </CardContent>
              </Card>
              <h3 className="text-lg font-medium mt-6 mb-2">Trips</h3>
              {getTruckTrips(selectedTruck.id).length === 0 ? (
                <p>No trips serviced.</p>
              ) : (
                <ul className="space-y-2">
                  {getTruckTrips(selectedTruck.id).map(trip => (
                    <li
                      key={trip.id}
                      className="p-3 border rounded-lg hover:bg-gray-100 cursor-pointer"
                      onClick={() => setSelectedTrip(trip)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{trip.short_id}</p>
                          <p className="text-sm text-gray-500">{trip.origin} → {trip.destination}</p>
                        </div>
                        <Badge variant={trip.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                          {trip.status}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {selectedTrip && (
            <div>
              <Button
                variant="outline"
                className="mb-4 bg-white border-gray-300 text-gray-900 hover:bg-gray-100"
                onClick={() => {
                  setSelectedTrip(null);
                  setSelectedTruck(selectedTruck ? selectedTruck : null);
                }}
              >
                <ChevronLeft size={16} className="mr-2" />
                Back to {selectedTruck ? 'Truck' : 'Owner'}
              </Button>
              <Card className="bg-white mb-6">
                <CardHeader>
                  <h2 className="text-xl font-semibold">Trip Details</h2>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p><strong>ID:</strong> {selectedTrip.short_id}</p>
                  <p><strong>Route:</strong> {selectedTrip.origin} → {selectedTrip.destination}</p>
                  <p><strong>Status:</strong> {selectedTrip.status}</p>
                  <p><strong>Start Time:</strong> {selectedTrip.start_time ? new Date(selectedTrip.start_time).toLocaleString() : 'N/A'}</p>
                  <p><strong>End Time:</strong> {selectedTrip.end_time ? new Date(selectedTrip.end_time).toLocaleString() : 'N/A'}</p>
                  <p><strong>Created:</strong> {new Date(selectedTrip.created_at).toLocaleDateString()}</p>
                </CardContent>
              </Card>
              <h3 className="text-lg font-medium mt-6 mb-2">Associated Truck</h3>
              {getTripTruck(selectedTrip) ? (
                <Card className="bg-white">
                  <CardContent className="space-y-4">
                    <p><strong>Number:</strong> {getTripTruck(selectedTrip)?.vehicle_number}</p>
                    <p><strong>Type:</strong> {getTripTruck(selectedTrip)?.vehicle_type}</p>
                    <p><strong>Active:</strong> {getTripTruck(selectedTrip)?.active ? 'Yes' : 'No'}</p>
                    <p><strong>Owner:</strong> {getTripOwner(selectedTrip)?.full_name || 'N/A'}</p>
                  </CardContent>
                </Card>
              ) : (
                <p>No associated truck found.</p>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}