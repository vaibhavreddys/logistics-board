'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import Navbar from '@/components/ui/Navbar';
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { Users, Truck, Route, FileText, Search, Bell, UserCircle, UserRound, ChevronLeft, Menu, Pencil } from 'lucide-react';

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
  truck_owners: TruckOwnerDetails[];
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

interface Payment {
  id: string;
  trip_id: string;
  trip_cost: number;
  advance_payment: number;
  toll_charges: number;
  halting_charges: number;
  traffic_fines: number;
  handling_charges: number;
  platform_fees: number;
  platform_fines: number;
  payment_status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  final_payment: number;
  client_cost: number | null;
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
  driver_phone: number;
  origin: string;
  destination: string;
  load_material: string;
  load_weight: number;
  payments?: Payment;
  profile?: Profile;
}

// Custom function for dd/mm/yyyy HH:mm format
const formatDateDDMMYYYY = (date: string): string => {
  console.log("Formatting Date : " + date);
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const year = d.getFullYear();
    const hours = d.getHours() % 12 || 12; // Convert to 12-hour format
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const period = d.getHours() >= 12 ? 'PM' : 'AM';
    return `${day}/${month}/${year} ${hours}:${minutes} ${period}`;
  } catch {
    return 'Invalid Date';
  }
};

const formatCurrency = (num: number | null | undefined) => {
  if (!num) return "₹0";
  return "₹" + num.toLocaleString("en-IN");
};

const calculatePaymentCleared = (trip: any) => {
  const advance_payment = trip.trip_payments?.advance_payment || 0;
  const final_payment = trip.trip_payments?.final_payment || 0;
  return advance_payment + final_payment;
};

const calculateBalance = (trip: any) => {
  const tripCost = trip.trip_payments?.trip_cost || 0;
  // Vehicle Providers get back this for letting their trucks halt due to client's delay in handling the load
  const vehicle_halting_charges = trip.trip_payments?.halting_charges || 0;
  const deductions = [
    trip.trip_payments?.advance_payment || 0,
    trip.trip_payments?.final_payment || 0,
    trip.trip_payments?.toll_charges || 0,
    trip.trip_payments?.traffic_fines || 0,
    trip.trip_payments?.handling_charges || 0,
    trip.trip_payments?.platform_fees || 0,
    trip.trip_payments?.platform_fines || 0,
  ].reduce((a, b) => a + Number(b), 0);
  console.log("Balance for " + trip.short_id + " = " + (tripCost - deductions + vehicle_halting_charges));
  return tripCost - deductions + vehicle_halting_charges;
};

const getTripGrossProfit = (payment: Payment) => {
  return formatCurrency((payment.client_cost ? payment.client_cost : 0) - payment.trip_cost);
};

const getTripEarnings = (payment: Payment) => {
  const client_cost = payment.client_cost ? payment.client_cost : 0;
  if (client_cost === 0) return 0;
  if (payment.advance_payment === 0 || payment.final_payment === 0) return 0;
  const amount_paid_to_vehicle_provider = payment.advance_payment + payment.final_payment + payment.halting_charges;
  return formatCurrency(client_cost - amount_paid_to_vehicle_provider);
};

export default function ProfilesPage() {
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
  const [truckOwners, setTruckOwners] = useState<TruckOwner[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOwner, setSelectedOwner] = useState<TruckOwner | null>(null);
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    role: 'truck_owner',
    aadhaar_or_pan: '',
    bank_account_number: '',
    bank_ifsc_code: '',
    upi_id: '',
    town_city: '',
  });
  const [initialFormValues, setInitialFormValues] = useState({
    full_name: '',
    phone: '',
    role: 'truck_owner',
    aadhaar_or_pan: '',
    bank_account_number: '',
    bank_ifsc_code: '',
    upi_id: '',
    town_city: '',
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const router = useRouter();

  // Check if any form field has changed
  const hasChanges = Object.keys(editForm).some(
    key => editForm[key as keyof typeof editForm] !== initialFormValues[key as keyof typeof initialFormValues]
  );

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login?redirect=/profiles");
        return;
      }

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
      if (ownersError) console.error('Error fetching truck owners:', ownersError);
      const formattedOwners = ownersData?.map(owner => ({
        ...owner,
        truck_owners: owner.truck_owners || [],
      })) || [];
      setTruckOwners(formattedOwners);

      const ownerIds = ownersData?.map(o => o.id) || [];
      const { data: trucksData, error: trucksError } = await supabase
        .from('trucks')
        .select('*')
        .in('owner_id', ownerIds);
      if (trucksError) console.error('Error fetching trucks:', trucksError);
      setTrucks(trucksData || []);

      const truckIds = trucksData?.map(t => t.id) || [];
      const { data: tripsData, error: tripsError } = await supabase
        .from('trips')
        .select(`
          *,
          indents!trips_indent_id_fkey (
            origin,
            destination,
            load_material,
            load_weight_kg
          ),
          trip_payments!trip_payments_trip_id_fkey (*),
          profiles!trips_truck_provider_id_fkey (
            id,
            full_name,
            phone,
            role,
            created_at
          )
        `)
        .in('truck_id', truckIds)
        .order('created_at', { ascending: false });
      if (tripsError) console.error('Error fetching trips:', tripsError);
      const formattedTrips = tripsData?.map(trip => ({
        ...trip,
        origin: trip.indents?.origin || 'N/A',
        destination: trip.indents?.destination || 'N/A',
        load_material: trip.indents?.load_material || '',
        load_weight: trip.indents?.load_weight_kg || 0,
        payments: trip.trip_payments,
        profile: trip.profiles,
        driver_phone: trip.driver_phone || 0,
      })) || [];
      setTrips(formattedTrips);
      console.log("Formatted Trips: ", formattedTrips);

      setLoading(false);
    };

    fetchData();
  }, [router]);

  useEffect(() => {
    const handleResize = () => {
      if (window.matchMedia('(min-width: 768px)').matches) {
        setSelectedOwner(null);
        setSelectedTruck(null);
        setSelectedTrip(null);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!editForm.full_name.trim()) errors.full_name = 'Full name is required';
    if (!editForm.phone.match(/^\+?[1-9]\d{1,14}$/)) errors.phone = 'Invalid phone number';
    if (!editForm.aadhaar_or_pan.match(/^[A-Z0-9]{10}$|^[0-9]{12}$/)) {
      errors.aadhaar_or_pan = 'Aadhaar (12 digits) or PAN (10 alphanumeric) required';
    }
    if (editForm.bank_ifsc_code && !editForm.bank_ifsc_code.match(/^[A-Z]{4}0[A-Z0-9]{6}$/)) {
      errors.bank_ifsc_code = 'Invalid IFSC code';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEditClick = () => {
    if (selectedOwner) {
      const initialValues = {
        full_name: selectedOwner.full_name || '',
        phone: selectedOwner.phone || '',
        role: selectedOwner.role || 'truck_owner',
        aadhaar_or_pan: selectedOwner.truck_owners[0]?.aadhaar_or_pan || '',
        bank_account_number: selectedOwner.truck_owners[0]?.bank_account_number || '',
        bank_ifsc_code: selectedOwner.truck_owners[0]?.bank_ifsc_code || '',
        upi_id: selectedOwner.truck_owners[0]?.upi_id || '',
        town_city: selectedOwner.truck_owners[0]?.town_city || '',
      };
      setEditForm(initialValues);
      setInitialFormValues(initialValues);
      setIsEditModalOpen(true);
    }
  };

  const handleSaveChanges = async () => {
    if (!validateForm()) return;

    try {
      // Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name,
          phone: editForm.phone,
          role: editForm.role,
        })
        .eq('id', selectedOwner?.id);

      if (profileError) throw profileError;

      // Update or insert into truck_owners table
      const { data: existingTruckOwner } = await supabase
        .from('truck_owners')
        .select('id')
        .eq('profile_id', selectedOwner?.id)
        .single();

      if (existingTruckOwner) {
        const { error: truckOwnerError } = await supabase
          .from('truck_owners')
          .update({
            aadhaar_or_pan: editForm.aadhaar_or_pan,
            bank_account_number: editForm.bank_account_number || null,
            bank_ifsc_code: editForm.bank_ifsc_code || null,
            upi_id: editForm.upi_id || null,
            town_city: editForm.town_city || null,
          })
          .eq('profile_id', selectedOwner?.id);
        if (truckOwnerError) throw truckOwnerError;
      } else {
        const { error: truckOwnerError } = await supabase
          .from('truck_owners')
          .insert({
            profile_id: selectedOwner?.id,
            aadhaar_or_pan: editForm.aadhaar_or_pan,
            bank_account_number: editForm.bank_account_number || null,
            bank_ifsc_code: editForm.bank_ifsc_code || null,
            upi_id: editForm.upi_id || null,
            town_city: editForm.town_city || null,
          });
        if (truckOwnerError) throw truckOwnerError;
      }

      // Update local state
      setTruckOwners(prev =>
        prev.map(owner =>
          owner.id === selectedOwner?.id
            ? {
                ...owner,
                full_name: editForm.full_name,
                phone: editForm.phone,
                role: editForm.role,
                truck_owners: [{
                  aadhaar_or_pan: editForm.aadhaar_or_pan,
                  bank_account_number: editForm.bank_account_number || null,
                  bank_ifsc_code: editForm.bank_ifsc_code || null,
                  upi_id: editForm.upi_id || null,
                  town_city: editForm.town_city || null,
                }],
              }
            : owner
        )
      );
      setSelectedOwner({
        ...selectedOwner!,
        full_name: editForm.full_name,
        phone: editForm.phone,
        role: editForm.role,
        truck_owners: [{
          aadhaar_or_pan: editForm.aadhaar_or_pan,
          bank_account_number: editForm.bank_account_number || null,
          bank_ifsc_code: editForm.bank_ifsc_code || null,
          upi_id: editForm.upi_id || null,
          town_city: editForm.town_city || null,
        }],
      });
      setIsEditModalOpen(false);
      setFormErrors({});
    } catch (error) {
      console.error('Error updating profile:', error);
      setFormErrors({ general: 'Failed to update profile. Please try again.' });
    }
  };

  const filteredOwners = truckOwners.filter(owner =>
    owner.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    owner.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (owner.truck_owners[0]?.town_city || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getOwnerTrucks = (ownerId: string) => trucks.filter(t => t.owner_id === ownerId);
  const getTruckTrips = (truckId: string) => trips.filter(t => t.truck_id === truckId);
  const getOwnerTrips = (ownerId: string) => {
    // const ownerTruckIds = getOwnerTrucks(ownerId).map(t => t.id);
    // return trips.filter(t => t.truck_id && ownerTruckIds.includes(t.truck_id));
    console.log("Filtered trips for owner id : ", ownerId);
    return trips.filter(t => t.profile?.id === ownerId)
  };
  const getTripTruck = (trip: Trip) => trucks.find(t => t.id === trip.truck_id);
  const getTripOwner = (trip: Trip) => truckOwners.find(o => getOwnerTrucks(o.id).some(t => t.id === trip.truck_id));
  
  const getTripGrossProfit = (payment: Payment) => {
    return formatCurrency((payment.client_cost? payment.client_cost : 0) - (payment.trip_cost));
  };

  const getTripEarnings = (payment: Payment) => {
    const client_cost = payment.client_cost? payment.client_cost : 0;
    if (client_cost === 0) return 0;
    if (payment.advance_payment === 0 || payment.final_payment === 0) return 0;
    const amount_paid_to_vehicle_provider = payment.advance_payment + payment.final_payment + payment.halting_charges;
    return formatCurrency(client_cost - amount_paid_to_vehicle_provider);
  }

  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;

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
                  <Badge
                    variant="secondary"
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
                <a href="/truck-owners?returnTo=/profiles" className="w-full">
                  <button className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition">
                    Onboard New Vehicle Provider
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
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">{selectedOwner.full_name}</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEditClick}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <Pencil size={16} className="mr-2" />
                    Edit
                  </Button>
                </div>

                

                <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                  <DialogContent className="max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Edit Profile</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="full_name">Full Name</Label>
                        <Input
                          id="full_name"
                          value={editForm.full_name}
                          onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                          className={formErrors.full_name ? 'border-red-500' : ''}
                        />
                        {formErrors.full_name && <p className="text-red-500 text-sm">{formErrors.full_name}</p>}
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          className={formErrors.phone ? 'border-red-500' : ''}
                        />
                        {formErrors.phone && <p className="text-red-500 text-sm">{formErrors.phone}</p>}
                      </div>
                      <div>
                        <Label htmlFor="role">Role</Label>
                        <Select
                          value={editForm.role}
                          onValueChange={(value) => setEditForm({ ...editForm, role: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="truck_owner">Truck Owner</SelectItem>
                            <SelectItem value="truck_agent">Truck Agent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="aadhaar_or_pan">Aadhaar / PAN</Label>
                        <Input
                          id="aadhaar_or_pan"
                          value={editForm.aadhaar_or_pan}
                          onChange={(e) => setEditForm({ ...editForm, aadhaar_or_pan: e.target.value })}
                          className={formErrors.aadhaar_or_pan ? 'border-red-500' : ''}
                        />
                        {formErrors.aadhaar_or_pan && <p className="text-red-500 text-sm">{formErrors.aadhaar_or_pan}</p>}
                      </div>
                      <div>
                        <Label htmlFor="town_city">City</Label>
                        <Input
                          id="town_city"
                          value={editForm.town_city}
                          onChange={(e) => setEditForm({ ...editForm, town_city: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="bank_account_number">Bank Account Number</Label>
                        <Input
                          id="bank_account_number"
                          value={editForm.bank_account_number}
                          onChange={(e) => setEditForm({ ...editForm, bank_account_number: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="bank_ifsc_code">IFSC Code</Label>
                        <Input
                          id="bank_ifsc_code"
                          value={editForm.bank_ifsc_code}
                          onChange={(e) => setEditForm({ ...editForm, bank_ifsc_code: e.target.value })}
                          className={formErrors.bank_ifsc_code ? 'border-red-500' : ''}
                        />
                        {formErrors.bank_ifsc_code && <p className="text-red-500 text-sm">{formErrors.bank_ifsc_code}</p>}
                      </div>
                      <div>
                        <Label htmlFor="upi_id">UPI ID</Label>
                        <Input
                          id="upi_id"
                          value={editForm.upi_id}
                          onChange={(e) => setEditForm({ ...editForm, upi_id: e.target.value })}
                        />
                      </div>
                      {formErrors.general && <p className="text-red-500 text-sm">{formErrors.general}</p>}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSaveChanges} disabled={!hasChanges}>
                        Save Changes
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                
                <div className="grid md:grid-cols-[minmax(200px,0.8fr)_1.2fr] md:auto-rows-auto gap-6">
                  <Card className="bg-white">
                    <CardContent className="mt-4 space-y-4">
                      <p><strong>Role:</strong> {selectedOwner.role === 'truck_owner' ? 'Truck Owner' : 'Truck Agent'}</p>
                      <p><strong>Phone:</strong> {selectedOwner.phone}</p>
                      <p><strong>Aadhar / PAN:</strong> {selectedOwner.truck_owners[0]?.aadhaar_or_pan || 'N/A'}</p>
                      <p><strong>City:</strong> {selectedOwner.truck_owners[0]?.town_city || 'N/A'}</p>
                      {selectedOwner.truck_owners[0]?.bank_account_number && (
                        <p><strong>Account Number:</strong> {selectedOwner.truck_owners[0].bank_account_number}</p>
                      )}
                      {selectedOwner.truck_owners[0]?.bank_ifsc_code && (
                        <p><strong>IFSC Number:</strong> {selectedOwner.truck_owners[0].bank_ifsc_code}</p>
                      )}
                      {selectedOwner.truck_owners[0]?.upi_id && (
                        <p><strong>UPI ID:</strong> {selectedOwner.truck_owners[0].upi_id}</p>
                      )}
                      <p><strong>Joined:</strong> {new Date(selectedOwner.created_at).toLocaleDateString()}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white md:row-span-2">
                    <CardHeader>
                      <h3 className="text-lg font-medium flex items-center">
                        <Route size={20} className="mr-2" />
                        Trips ({getOwnerTrips(selectedOwner.id).length})
                      </h3>
                    </CardHeader>
                    <CardContent>
                      {getOwnerTrips(selectedOwner.id).length === 0 ? (
                        <p className="text-gray-500">No trips serviced.</p>
                      ) : (
                        <ul className="space-y-2">
                          {getOwnerTrips(selectedOwner.id).map(trip => (
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
                                  <p className="font-medium">{trip.origin} ⮕ {trip.destination} ({getTripTruck(trip)?.vehicle_number} - {getTripTruck(trip)?.vehicle_type})</p>
                                  <p className="text-sm text-gray-500">{trip.short_id} | Trip Cost: {formatCurrency(trip.payments?.trip_cost)}</p>
                                  <p className="text-sm text-gray-500">Balance: {formatCurrency(calculateBalance(trip))}</p>
                                </div>
                                <Badge
                                  variant={
                                    trip.status === "completed"
                                      ? "default"
                                      : trip.status === "started"
                                      ? "success"
                                      : trip.status === "cancelled"
                                      ? "destructive"
                                      : "default"
                                  }
                                  className="text-xs"
                                >
                                  {
                                    trip.status === "completed"
                                      ? "COMPLETED"
                                      : trip.status === "started"
                                      ? "STARTED"
                                      : trip.status === "cancelled"
                                      ? "CANCELLED"
                                      : ""
                                  }
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
              <h3 className="text-lg font-semibold mt-6 mb-1">Truck Details</h3>
              <Card className="bg-white mb-6">
                {/* <CardHeader>
                  <h2 className="text-xl font-semibold"></h2>
                </CardHeader> */}
                <CardContent className="space-y-4 mt-4">
                  <p><strong>Number:</strong> {selectedTruck.vehicle_number}</p>
                  <p><strong>Type:</strong> {selectedTruck.vehicle_type}</p>
                  <p><strong>Capacity:</strong> {selectedTruck.capacity_kg || 'N/A'} kg</p>
                  <p><strong>Active:</strong> {selectedTruck.active ? 'Yes' : 'No'}</p>
                  <p><strong>Owner:</strong> {truckOwners.find(o => o.id === selectedTruck.owner_id)?.full_name || 'N/A'}</p>
                </CardContent>
              </Card>
              <h3 className="text-lg font-semibold mt-6 mb-1">Trips</h3>
              {getTruckTrips(selectedTruck.id).length === 0 ? (
                <p>No trips serviced.</p>
              ) : (
                <ul className="space-y-2">
                  {getTruckTrips(selectedTruck.id).map(trip => (
                    <li
                      key={trip.id}
                      className="p-3 border rounded-lg hover:bg-gray-100 cursor-pointer"
                      onClick={() => { setSelectedTrip(trip); }}
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
              <h3 className="text-lg font-semibold mt-6 mb-1">Trip Details</h3>
              <Card className="bg-white mb-6">
                {/* <CardHeader>
                  <h2 className="text-xl font-semibold">Trip Details</h2>
                </CardHeader> */}
                <CardContent className="space-y-4 mt-4">
                  <p><strong>ID:</strong> {selectedTrip.short_id}</p>
                  <p><strong>Route:</strong> {selectedTrip.origin} → {selectedTrip.destination}</p>
                  <p><strong>Status:</strong> {selectedTrip.status}</p>
                  <p><strong>Start Time:</strong> {selectedTrip.start_time ? formatDateDDMMYYYY(selectedTrip.start_time) : 'N/A'}</p>
                  <p><strong>End Time:</strong> {selectedTrip.end_time ? formatDateDDMMYYYY(selectedTrip.end_time) : 'N/A'}</p>
                  <p><strong>Created:</strong> {formatDateDDMMYYYY(selectedTrip.created_at)}</p>
                  <p><strong>Driver Phone:</strong> {selectedTrip.driver_phone}</p>
                  {selectedTrip.load_material ? (
                    <p><strong>Load:</strong> {selectedTrip.load_material} | {selectedTrip.load_weight} MT</p>
                  ) : (
                    <></>
                  )}
                  <p><strong>Trip Placed By:</strong> {selectedTrip.profile?.full_name} ({selectedTrip.profile?.role === "truck_agent" ? "Truck Agent" : "Truck Owner"})</p>
                </CardContent>
              </Card>
              <h3 className="text-lg font-semibold mt-6 mb-1">Payment Information</h3>
              <Card className="bg-white mb-6">
                {/* <CardHeader>
                  <h3 className="text-lg font-semibold">Payment Information</h3>
                </CardHeader> */}
                <CardContent className="space-y-4 mt-4">
                  {/* <br></br> */}
                  {selectedTrip.payments ? (
                    <>
                      <p><strong>Client Cost:</strong> {formatCurrency(selectedTrip.payments.client_cost)}</p>
                      <p><strong>Trip Cost:</strong> {formatCurrency(selectedTrip.payments.trip_cost)}</p>
                      <p><strong>Gross Trip Profit:</strong> {getTripGrossProfit(selectedTrip.payments)}</p>
                      <p><strong>Net Trip Profit:</strong> {getTripEarnings(selectedTrip.payments)}</p>
                      <p><strong>Advance Payment:</strong> {formatCurrency(selectedTrip.payments.advance_payment)}</p>
                      <p><strong>Final Payment:</strong> {formatCurrency(selectedTrip.payments.final_payment)}</p>
                      <p><strong>Halting Charges:</strong> {formatCurrency(selectedTrip.payments.halting_charges)}</p>
                      <p><strong>Handling Charges:</strong> {formatCurrency(selectedTrip.payments.handling_charges)}</p>
                      <p><strong>Platform Fees:</strong> {formatCurrency(selectedTrip.payments.platform_fees)}</p>
                      <p><strong>Payment Status:</strong> {selectedTrip.payments.payment_status}</p>
                      <p className="text-lg font-extrabold"><strong>Payment Cleared:</strong> {formatCurrency(calculatePaymentCleared(selectedTrip))}</p>
                      <p className="text-lg font-extrabold"><strong>Balance Pending:</strong> {formatCurrency(calculateBalance(selectedTrip))}</p>
                      <p><strong>Notes:</strong> {selectedTrip.payments.notes || 'N/A'}</p>
                      <h5 className='text-sm'>(Platform Fees is included into "Net Trip Profit")</h5>
                    </>
                  ) : (
                    <p>No payment information available.</p>
                  )}
                </CardContent>
              </Card>
              <h3 className="text-lg font-semibold mt-6 mb-1">Associated Truck</h3>
              {getTripTruck(selectedTrip) ? (
                <Card className="bg-white">
                  <CardContent className="space-y-4 mt-4">
                    <p><strong>Number:</strong> {getTripTruck(selectedTrip)?.vehicle_number}</p>
                    <p><strong>Type:</strong> {getTripTruck(selectedTrip)?.vehicle_type}</p>
                    <p><strong>Active:</strong> {getTripTruck(selectedTrip)?.active ? 'Yes' : 'No'}</p>
                    <p><strong>Owner:</strong> {getTripOwner(selectedTrip)?.full_name || 'N/A'}</p>
                  </CardContent>
                </Card>
              ) : (
                <p>No associated truck found.</p>
              )}
              <h3 className="text-lg font-semibold mt-6 mb-1">Truck Provider</h3>
              {selectedTrip.profile? (
                <Card className="bg-white">
                  <CardContent className="space-y-4 mt-4">
                    <p><strong>Name:</strong> {selectedTrip.profile?.full_name || 'N/A'}</p>
                    <p><strong>Phone:</strong> {selectedTrip.profile.phone || 'N/A'}</p>
                    <p><strong>Role:</strong> {selectedTrip.profile.role === 'truck_owner' ? 'Truck Owner' : 'Truck Agent'}</p>
                    <p><strong>Joined:</strong> {new Date(selectedTrip.profile.created_at).toLocaleDateString()}</p>
                  </CardContent>
                </Card>
              ) : (
                <p>No truck provider information available.</p>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}