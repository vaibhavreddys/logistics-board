'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Navbar from '@/components/ui/Navbar';
import { X, History, Info, Pencil } from 'lucide-react';
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

export default function TripsPage() {
  const [trips, setTrips] = useState<any[]>([]);
  const [history, setHistory] = useState<Record<string, any[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [isNewStatusSelected, setIsNewStatusSelected] = useState(false);
  const [tab, setTab] = useState('active');
  const [paymentData, setPaymentData] = useState({
    client_cost: 0,
    trip_cost: 0,
    advance_payment: 0,
    final_payment: 0,
    toll_charges: 0,
    halting_charges: 0,
    traffic_fines: 0,
    handling_charges: 0,
    platform_fees: 0,
    platform_fines: 0,
    payment_status: 'Pending',
  });
  const [initialPaymentData, setInitialPaymentData] = useState(paymentData);
  const [originalPaymentData, setOriginalPaymentData] = useState(paymentData);

  const [showDeductions, setShowDeductions] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (paymentModalOpen) {
      setOriginalPaymentData(paymentData);
    }
  }, [paymentModalOpen]);

  function arePaymentsEqual(a: typeof paymentData, b: typeof paymentData) {
    return (
      Number(a.client_cost) === Number(b.client_cost) &&
      Number(a.trip_cost) === Number(b.trip_cost) &&
      Number(a.advance_payment) === Number(b.advance_payment) &&
      Number(a.final_payment) === Number(b.final_payment) &&
      Number(a.toll_charges) === Number(b.toll_charges) &&
      Number(a.halting_charges) === Number(b.halting_charges) &&
      Number(a.traffic_fines) === Number(b.traffic_fines) &&
      Number(a.handling_charges) === Number(b.handling_charges) &&
      Number(a.platform_fees) === Number(b.platform_fees) &&
      Number(a.platform_fines) === Number(b.platform_fines) &&
      a.payment_status === b.payment_status
    );
  }

  // Calculate balance based on paymentData, updates automatically when paymentData changes
  const getTripBalance = () => {
    console.log("Calculating Trip balance from getTripBalance");
    const balance =
      Number(paymentData.trip_cost || 0) -
      Number(paymentData.advance_payment || 0) -
      Number(paymentData.final_payment || 0) +
      Number(paymentData.halting_charges || 0) -
      Number(paymentData.handling_charges || 0) -
      Number(paymentData.platform_fees || 0);
    return isNaN(balance) ? 0 : balance;
  };

  // const isModified = JSON.stringify(paymentData) !== JSON.stringify(originalPaymentData);
  const isModified = !arePaymentsEqual(paymentData, originalPaymentData);
  const isTripPaymentModDisabled = () => {
    const currentStatus = trips.find(i => i.id === selectedTripId)?.status || "";
    console.log("Trip status is " + currentStatus + " - modifiable = " + (currentStatus === "started" || currentStatus === "completed"));
    return (currentStatus === "created" || currentStatus === "cancelled")
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        router.push("/login?redirect=/trips");
        return;
      }
    };
    checkAuth();

    const fetchTrips = async () => {
      try {
        const { data: t, error: tripError } = await supabase
          .from('trips')
          .select(`
            *,
            indents!indent_id(
              *,
              clients(name),
              trip_cost,
              vehicle_number,
              vehicle_type,
              origin,
              destination,
              load_material,
              load_weight_kg,
              driver_phone,
              contact_phone
            ),
            trip_payments!trip_payments_trip_id_fkey(
              trip_cost,
              client_cost,
              advance_payment,
              final_payment,
              toll_charges,
              halting_charges,
              traffic_fines,
              handling_charges,
              platform_fees,
              platform_fines,
              payment_status
            ),
            client_cost,
            short_id,
            status
          `)
          .order('created_at', { ascending: false });

        if (tripError) {
          console.log('Supabase Error Details:', tripError);
          setError(`Failed to load trips: ${tripError.message}`);
          return;
        }
        setTrips(t || []);
        console.log('Trips updated:', t);
      } catch (err) {
        console.log('Fetch Error Details:', err);
        setError('Failed to load data. Check console for details.');
      }
    };
    fetchTrips();

    const channel = supabase
      .channel('trips-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, (payload) => {
        console.log('Trips change detected:', payload);
        fetchTrips();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_payments' }, (payload) => {
        console.log('Trip payments change detected:', payload);
        fetchTrips();
      })
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const filteredTrips = useMemo(() => {
    const s = q.toLowerCase();
    const activeStates = ['created', 'started', 'paused', 'stopped'];

    return trips.filter(i => {
      const isActive = activeStates.includes(i.status);
      const isCompleted = i.status === 'completed';
      const isCancelled = i.status === 'cancelled';

      if (tab === 'active' && !isActive) return false;
      if (tab === 'completed' && !isCompleted) return false;
      if (tab === 'cancelled' && !isCancelled) return false;

      const origin = i.indents?.origin || '';
      const destination = i.indents?.destination || '';
      const vehicleType = i.indents?.vehicle_type || '';
      const vehicleNumber = i.indents?.vehicle_number || '';
      const clientName = i.indents?.clients?.name || '';

      return [origin, destination, vehicleType, vehicleNumber, clientName].some(
        t => t.toLowerCase().includes(s)
      );
    });
  }, [q, trips, tab]);

  const updateTripStatus = async () => {
    setLoading(true);
    try {
      if (!newStatus) {
        setError('Please select a status.');
        return;
      }
      setError(null);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setError('You must be logged in to update trip status.');
        return;
      }

      const currentTrip = trips.find(i => i.id === selectedTripId);
      if (!currentTrip) {
        setError('Trip not found.');
        return;
      }

      if (currentTrip.status === newStatus) {
        setStatusModalOpen(false);
        return;
      }

      trips.find(i => i.id === selectedTripId)?.indents?.client_cost || 0;

      const payload = { 
        status: newStatus,
        updated_at: new Date().toISOString(),
        ...(newStatus === "Started" && {
          trip_cost: currentTrip.indents?.trip_cost,
          client_cost: currentTrip.indents?.client_cost,
        })
      };

      const { error: updateError } = await supabase.from('trips').update(payload).eq('id', selectedTripId);
      if (updateError) {
        setError(`Failed to update trip status: ${updateError.message}`);
        return;
      }

      await supabase.from('trip_status_history').insert({
        trip_id: selectedTripId,
        to_status: newStatus,
        changed_by: user.id,
        remark: `status --> ${newStatus}`,
      });

      const { data: updatedTrips } = await supabase
        .from('trips')
        .select('*, indents!indent_id(*, clients(name), trip_cost, vehicle_number, vehicle_type, origin, destination, load_material, load_weight_kg, driver_phone, contact_phone), client_cost, short_id, status')
        .order('created_at', { ascending: false });
      setTrips(updatedTrips || []);
      setSuccess('Trip status updated successfully!');
      setTimeout(() => setSuccess(null), 5000);
      setStatusModalOpen(false);
      setNewStatus('');
    } catch {
      setError('Failed to update trip status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (tripId: string) => {
    setLoading(true);
    try {
      const { data: h, error: historyError } = await supabase
        .from('trip_status_history')
        .select('*, profiles!trip_status_history_changed_by_fkey(full_name)')
        .eq('trip_id', tripId)
        .order('changed_at', { ascending: false });
      if (historyError) {
        setError('Failed to load status history.');
        return;
      }
      setHistory(prev => ({ ...prev, [tripId]: h || [] }));
      setSelectedTripId(tripId);
      setHistoryModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'created': return 'bg-blue-100 text-blue-800';
      case 'started': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'stopped': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const parseCurrencyInput = (value: string): number => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const num = Number(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const formatCurrency = (num: number | null | undefined) => {
    if (!num) return "₹0";
    return "₹" + num.toLocaleString("en-IN");
  };

  const calculatePaymentCleared = (trip: any) => {
    const advance_payment = trip.trip_payments?.advance_payment || 0;
    const final_payment = trip.trip_payments?.final_payment || 0;
    return advance_payment + final_payment;
  }
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
    // console.log("Payments for trip: " + trip.short_id,
    //   {
    //   "tripcost" : tripCost,
    //   "deductions": deductions,
    //   "halting charges": vehicle_halting_charges,
    //   "final_payment" : final_payment
    // }, "Formula: Balance = tripCost - final_payment - deduction + halting charges");
    console.log("Balance for " + trip.short_id + " = " + (tripCost - deductions + vehicle_halting_charges));
    return tripCost - deductions + vehicle_halting_charges;
  };

  const updatePayment = async () => {
    setLoading(true);
    try {
      if (!selectedTripId) {
        setError('No trip selected.');
        return;
      }
      setError(null);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setError('You must be logged in to update payment.');
        return;
      }

      const payload = {
        trip_id: selectedTripId,
        ...paymentData,
        updated_at: new Date().toISOString(),
      };
      console.log("From updatePayment: paymentData=");
      console.log(paymentData);
      const { error: updateError } = await supabase
        .from('trip_payments')
        .upsert(payload, { onConflict: 'trip_id' });

      if (updateError) {
        setError(`Failed to update payment: ${updateError.message}`);
        return;
      }

      const { data: updatedTrips } = await supabase
        .from('trips')
        .select(`
          *,
          indents!indent_id(
            *,
            clients(name),
            trip_cost,
            vehicle_number,
            vehicle_type,
            origin,
            destination,
            load_material,
            load_weight_kg,
            driver_phone,
            contact_phone
          ),
          trip_payments!trip_payments_trip_id_fkey(
            trip_cost,
            client_cost,
            advance_payment,
            final_payment,
            toll_charges,
            halting_charges,
            traffic_fines,
            handling_charges,
            platform_fees,
            platform_fines,
            payment_status
          ),
          client_cost,
          short_id,
          status
        `)
        .order('created_at', { ascending: false });

      setTrips(updatedTrips || []);
      setSuccess('Payment updated successfully!');
      setTimeout(() => setSuccess(null), 5000);
      setPaymentModalOpen(false);
      setPaymentData({
        client_cost: 0,
        trip_cost: 0,
        advance_payment: 0,
        final_payment: 0,
        toll_charges: 0,
        halting_charges: 0,
        traffic_fines: 0,
        handling_charges: 0,
        platform_fees: 0,
        platform_fines: 0,
        payment_status: 'Pending',
      });
    } catch {
      setError('Failed to update payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <main className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Alerts */}
        {error && (
          <div className="bg-red-100 text-red-700 p-2 rounded flex justify-between items-center">
            {error}
            <button onClick={() => setError(null)}><X size={16} /></button>
          </div>
        )}
        {success && (
          <div className="bg-green-100 text-green-700 p-2 rounded flex justify-between items-center animate-pulse">
            {success}
            <button onClick={() => setSuccess(null)}><X size={16} /></button>
          </div>
        )}

        {/* Header + Search */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Trips ({filteredTrips.length})</h2>
            <Input placeholder="Search by place / vehicle / client" value={q} onChange={e => setQ(e.target.value)} className="max-w-sm" />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="active" onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-3 bg-gray-100 rounded-lg ">
              <TabsTrigger
                value="active"
                className="px-1 py-2 text-lg font-medium rounded-md transition-all duration-200
                  data-[state=active]:bg-blue-600 data-[state=active]:text-white
                  hover:bg-blue-50 hover:text-blue-700
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  text-gray-600"
              >
                Active
              </TabsTrigger>
              <TabsTrigger
                value="completed"
                className="px-4 py-3 text-lg font-medium rounded-md transition-all duration-200
                  data-[state=active]:bg-blue-600 data-[state=active]:text-white
                  hover:bg-blue-50 hover:text-blue-700
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  text-gray-600"
              >
                Completed
              </TabsTrigger>
              <TabsTrigger
                value="cancelled"
                className="px-4 py-3 text-lg font-medium rounded-md transition-all duration-200
                  data-[state=active]:bg-blue-600 data-[state=active]:text-white
                  hover:bg-blue-50 hover:text-blue-700
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  text-gray-600"
              >
                Cancelled
              </TabsTrigger>
            </TabsList>

            <TabsContent value={tab} className="mt-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {filteredTrips.map(i => (
                  <Card key={i.id} className="w-full bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
                    {/* Gradient Header */}
                    <div className="px-2 py-2 relative bg-gradient-to-r from-indigo-600 to-indigo-400">
                      <div className="relative z-10">
                        <div className="flex justify-between items-center">
                          {/* Left: ID + History */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-white bg-white/20 px-2 py-1 rounded-full">{i.short_id || "Trip ID ?"}</span>
                            <button onClick={() => fetchHistory(i.id)} className="p-1 rounded-full hover:bg-white/20 text-white" title="View History">
                              <History size={14} />
                            </button>
                          </div>

                          {/* Center: Date */}
                          <span className="text-xs text-indigo-200">{formatDateDDMMYYYY(i.created_at)}</span>

                          {/* Right: Status button + Edit icon */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setSelectedTripId(i.id); setNewStatus(i.status); setStatusModalOpen(true); }}
                              className={`px-2 py-0.5 rounded text-xs shadow-sm hover:shadow-md transition flex items-center gap-1 ${getStatusColor(i.status)}`}
                              title="Click to update status"
                            >
                              <span>{i.status.charAt(0).toUpperCase() + i.status.slice(1)}</span>
                              <Pencil size={12} className="opacity-70" />
                            </button>
                          </div>
                        </div>

                        {/* Origin → Destination + Info inline */}
                        <div className="text-center mt-1 mb-2 leading-tight">
                          <h2 className="text-lg font-semibold text-white flex items-center justify-center gap-2">
                            <span className="truncate max-w-[100px]">{i.indents?.origin || 'N/A'}</span>
                            <span className="text-indigo-200">⮕</span>
                            <span className="truncate max-w-[100px]">{i.indents?.destination || 'N/A'}</span>
                          </h2>
                          <div className="flex items-center justify-center gap-2 mt-0.5">
                            <p className="text-indigo-100 text-s">
                              {i.indents?.vehicle_number || 'N/A'} | {i.indents?.vehicle_type || 'N/A'}
                            </p>
                            <button
                              onClick={() => { setSelectedTripId(i.id); setInfoModalOpen(true); }}
                              className="p-1 rounded-full bg-white/20 text-white hover:bg-white/30"
                              title="View Trip Details"
                            >
                              <Info size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Section */}
                    <div className="px-3 py-3 bg-white">
                      <div className="grid grid-cols-3 gap-4 text-center items-center">
                        {/* Left Column */}
                        <div className="space-y-2">
                            <div>
                              <p className="text-xs text-gray-500">Trip Cost</p>
                              <p className="text-sm font-semibold text-gray-900">
                                {formatCurrency(i?.trip_payments?.trip_cost || i?.indents?.trip_cost || 0)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Payment Cleared</p>
                              <p className="text-sm font-semibold text-gray-900">
                                {formatCurrency(calculatePaymentCleared(i))}
                              </p>
                            </div>
                        </div>

                        {/* Center Column */}
                        <div className="flex flex-col items-center justify-center">
                          <p className="text-xs text-gray-500">Balance</p>
                          <p className="text-lg font-extrabold text-gray-900">
                            {formatCurrency(calculateBalance(i))}
                          </p>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-2">
                            <div>
                              <p className="text-xs text-gray-500">Client Cost</p>
                              <p className="text-sm font-semibold text-gray-900">
                                {formatCurrency(i?.trip_payments?.client_cost || i?.indents?.client_cost || 0)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Platform Fees</p>
                              <p className="text-sm font-semibold text-gray-900">
                                {formatCurrency(i.trip_payments?.platform_fees || 0)}
                              </p>
                            </div>
                          </div>
                          {/* <div className="space-y-2">
                          <div>
                            <p className="text-xs text-gray-500">Deductions</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatCurrency(
                                [
                                  i.trip_payments?.toll_charges,
                                  i.trip_payments?.traffic_fines,
                                  i.trip_payments?.handling_charges,
                                  i.trip_payments?.platform_fees,
                                  i.trip_payments?.platform_fines,
                                ].filter(Boolean).reduce((a, b) => a + Number(b), 0) - i.trip_payments?.halting_charges
                              )}
                            </p>
                          </div>
                        </div> */}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          {/* Status Update Modal */}
          <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Update Trip Status</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">New Status</label>
                  <select
                    className="w-full border rounded p-2 mt-1"
                    value={newStatus}
                    onChange={(e) => {
                      const selected = e.target.value;
                      const currentStatus = trips.find(i => i.id === selectedTripId)?.status || "";

                      setNewStatus(selected);
                      setIsNewStatusSelected(
                        selected !== "" && selected !== currentStatus
                      );
                    }}
                    disabled={loading}
                  >
                    {/* {['created', 'started', 'paused', 'stopped', 'completed', 'cancelled'].map(status => ( */}
                    {['created', 'started', 'completed', 'cancelled'].map(status => {
                    const currentStatus = trips.find(i => i.id === selectedTripId)?.status;

                    const isDisabled = (() => {
                      if (!currentStatus) return false; // default allow if undefined

                      switch (currentStatus) {
                        case 'created':
                          return status === 'created' || status === 'completed'; // only allow started & cancelled
                        case 'started':
                          return status === 'created'; // allow completed & cancelled
                        case 'completed':
                        case 'cancelled':
                          return true; // disable all options
                        default:
                          return false;
                      }
                    })();

                    return (
                      <option key={status} value={status} disabled={isDisabled}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    );
                  })}
                  </select>
                </div>
                {error && <div className="text-red-700 text-sm">{error}</div>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStatusModalOpen(false)} disabled={loading}>
                  Cancel
                </Button>
                <Button onClick={updateTripStatus} disabled={loading || !isNewStatusSelected}>
                  {loading ? 'Processing...' : 'Update'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* History Modal */}
          <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Status History</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {(history[selectedTripId || ''] || []).map((h, index) => (
                  <div key={h.id} className={`p-2 rounded ${index === 0 ? 'bg-gray-100 font-bold' : 'bg-white'} text-sm`}>
                    <div className="text-gray-600">
                      {new Date(h.changed_at).toLocaleString()} — {h.to_status} by {h.profiles?.full_name || 'Unknown'}
                    </div>
                  </div>
                ))}
                {(!history[selectedTripId || ''] || history[selectedTripId || ''].length === 0) && (
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

          {/* Info Modal */}
          <Dialog open={infoModalOpen} onOpenChange={setInfoModalOpen}>
            <DialogContent className="max-w-2xl sm:max-w-md p-2">
              <DialogHeader className="p-2">
                <DialogTitle className="text-lg">Trip Details</DialogTitle>
              </DialogHeader>
              <div className="p-2 max-h-[60vh] overflow-y-auto">
                {selectedTripId && (
                  <table className="w-full text-sm border-collapse">
                    <tbody>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-100">Trip ID</td>
                        <td className="py-1 bg-gray-100">{trips.find(i => i.id === selectedTripId)?.short_id || 'N/A'}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Origin</td>
                        <td className="py-1">{trips.find(i => i.id === selectedTripId)?.indents?.origin || 'N/A'}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-100">Destination</td>
                        <td className="py-1 bg-gray-100">{trips.find(i => i.id === selectedTripId)?.indents?.destination || 'N/A'}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Vehicle Number</td>
                        <td className="py-1">{trips.find(i => i.id === selectedTripId)?.indents?.vehicle_number || 'N/A'}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-100">Vehicle Type</td>
                        <td className="py-1 bg-gray-100">{trips.find(i => i.id === selectedTripId)?.indents?.vehicle_type || 'N/A'}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Load</td>
                        <td className="py-1">{trips.find(i => i.id === selectedTripId)?.indents?.load_material || 'N/A'}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-100">Weight</td>
                        <td className="py-1 bg-gray-100">{trips.find(i => i.id === selectedTripId)?.indents?.load_weight_kg || 'N/A'} MT</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Driver Phone</td>
                        <td className="py-1">{trips.find(i => i.id === selectedTripId)?.indents?.driver_phone || 'N/A'}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-100">Contact Phone</td>
                        <td className="py-1 bg-gray-100">{trips.find(i => i.id === selectedTripId)?.indents?.contact_phone || 'N/A'}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Client Name</td>
                        <td className="py-1">{trips.find(i => i.id === selectedTripId)?.indents?.clients?.name || 'N/A'}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-100">Client Cost</td>
                        <td className="py-1 bg-gray-100">{formatCurrency(trips.find(i => i.id === selectedTripId)?.indents?.client_cost || 0)}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Trip Cost</td>
                        <td className="py-1">{formatCurrency(trips.find(i => i.id === selectedTripId)?.trip_payments?.trip_cost || 0)}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-100">Advance Amount Paid</td>
                        <td className="py-1 bg-gray-100">{formatCurrency(trips.find(i => i.id === selectedTripId)?.trip_payments?.advance_payment || 0)}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Final Amount Paid</td>
                        <td className="py-1">{formatCurrency(trips.find(i => i.id === selectedTripId)?.trip_payments?.final_payment || 0)}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-100">Load Handling Charges</td>
                        <td className="py-1 bg-gray-100">{formatCurrency(trips.find(i => i.id === selectedTripId)?.trip_payments?.handling_charges || 0)}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Halting Charges (Refunded)</td>
                        <td className="py-1 bg-gray-50">{formatCurrency(trips.find(i => i.id === selectedTripId)?.trip_payments?.halting_charges || 0)}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-100">Platform Fees</td>
                        <td className="py-1 bg-gray-100">{formatCurrency(trips.find(i => i.id === selectedTripId)?.trip_payments?.platform_fees || 0)}</td>
                      </tr>
                      {/* <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Other Charges</td>
                        <td className="py-1">₹{
                          [
                            trips.find(i => i.id === selectedTripId)?.trip_payments?.toll_charges,
                            trips.find(i => i.id === selectedTripId)?.trip_payments?.halting_charges,
                            trips.find(i => i.id === selectedTripId)?.trip_payments?.traffic_fines,
                            trips.find(i => i.id === selectedTripId)?.trip_payments?.handling_charges,
                            trips.find(i => i.id === selectedTripId)?.trip_payments?.platform_fees,
                            trips.find(i => i.id === selectedTripId)?.trip_payments?.platform_fines,
                          ].filter(Boolean).reduce((a, b) => a + Number(b), 0)
                        }</td>
                      </tr> */}
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-300">Balance Amount</td>
                        <td className="py-1 bg-gray-300 font-semibold">₹{calculateBalance(trips.find(i => i.id === selectedTripId))}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Status</td>
                        <td className="py-1">{trips.find(i => i.id === selectedTripId)?.status || 'N/A'}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-100">Created At</td>
                        <td className="py-1 bg-gray-100">{formatDateDDMMYYYY(trips.find(i => i.id === selectedTripId)?.created_at) || 'N/A'}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
                {isTripPaymentModDisabled() && (
                  <p className="text-red-700 text-sm">Trip should be Started or Completed to modify payments</p>
                )}
              </div>
              <DialogFooter className="p-2 flex justify-between">
                <Button variant="outline" onClick={() => setInfoModalOpen(false)} disabled={loading} className="text-sm px-3 py-1">
                  Close
                </Button>
                <Button
                  onClick={() => {
                    const trip = trips.find(i => i.id === selectedTripId);
                    if (trip?.trip_payments) {
                      const newPaymentData = {
                        client_cost: trip?.trip_payments?.client_cost || 0,
                        trip_cost: trip?.trip_payments?.trip_cost || 0,
                        advance_payment: trip?.trip_payments?.advance_payment || 0,
                        final_payment: trip?.trip_payments?.final_payment || 0,
                        toll_charges: trip?.trip_payments?.toll_charges || 0,
                        halting_charges: trip?.trip_payments?.halting_charges || 0,
                        traffic_fines: trip?.trip_payments?.traffic_fines || 0,
                        handling_charges: trip?.trip_payments?.handling_charges || 0,
                        platform_fees: trip?.trip_payments?.platform_fees || 0,
                        platform_fines: trip?.trip_payments?.platform_fines || 0,
                        payment_status: trip?.trip_payments?.payment_status || 'Pending',
                      };
                      setPaymentData(newPaymentData);
                      setInitialPaymentData(newPaymentData);
                    }
                    setPaymentModalOpen(true);
                  }}
                  disabled={isTripPaymentModDisabled()}
                  className="text-sm px-3 py-1"
                >
                  Manage Payments
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Payment Modal */}
          <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Update Payment Details ({trips.find(i => i.id === selectedTripId)?.short_id || 'N/A'})</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="text-sm font-medium">Client Cost</label>
                  <Input
                    type="text"
                    // Show empty string for 0, otherwise format as currency
                    value={paymentData.client_cost === 0 ? '' : formatCurrency(paymentData.client_cost)}
                    // Parse input to number, update paymentData, trigger re-render for balance
                    onChange={(e) => setPaymentData({ ...paymentData, client_cost: parseCurrencyInput(e.target.value) })}
                    className="w-full mt-1"
                    placeholder="₹0"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Trip Cost</label>
                  <Input
                    type="text"
                    value={paymentData.trip_cost === 0 ? '' : formatCurrency(paymentData.trip_cost)}
                    // onChange updates paymentData, triggering a re-render and updating balance
                    onChange={(e) => setPaymentData({ ...paymentData, trip_cost: parseCurrencyInput(e.target.value) })}
                    className="w-full mt-1"
                    placeholder="₹0"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Advance Payment</label>
                  <Input
                    type="text"
                    value={paymentData.advance_payment === 0 ? '' : formatCurrency(paymentData.advance_payment)}
                    onChange={(e) => setPaymentData({ ...paymentData, advance_payment: parseCurrencyInput(e.target.value) })}
                    className="w-full mt-1"
                    placeholder="₹0"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Final Payment</label>
                  <Input
                    type="text"
                    value={paymentData.final_payment === 0 ? '' : formatCurrency(paymentData.final_payment)}
                    // onChange updates paymentData, triggering a re-render and updating balance
                    onChange={(e) => setPaymentData({ ...paymentData, final_payment: parseCurrencyInput(e.target.value) })}
                    className="w-full mt-1"
                    placeholder="₹0"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Show Deductions</label>
                  <input
                    type="checkbox"
                    checked={showDeductions}
                    onChange={(e) => setShowDeductions(e.target.checked)}
                    className="ml-2 h-4 w-4"
                  />
                </div>
                {showDeductions && (
                  <div className="space-y-4 pl-4 border-l-2 border-gray-200">
                    <div>
                      <label className="text-sm font-medium">Halting Charges (Refunded back to Vehicle Providers)</label>
                      <Input
                        type="text"
                        value={paymentData.halting_charges === 0 ? '' : formatCurrency(paymentData.halting_charges)}
                        // onChange updates paymentData, triggering a re-render and updating balance
                        onChange={(e) => setPaymentData({ ...paymentData, halting_charges: parseCurrencyInput(e.target.value) })}
                        className="w-full mt-1"
                        placeholder="₹0"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Load Handling Charges</label>
                      <Input
                        type="text"
                        value={paymentData.handling_charges === 0 ? '' : formatCurrency(paymentData.handling_charges)}
                        // onChange updates paymentData, triggering a re-render and updating balance
                        onChange={(e) => setPaymentData({ ...paymentData, handling_charges: parseCurrencyInput(e.target.value) })}
                        className="w-full mt-1"
                        placeholder="₹0"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Platform Fees</label>
                      <Input
                        type="text"
                        value={paymentData.platform_fees === 0 ? '' : formatCurrency(paymentData.platform_fees)}
                        // onChange updates paymentData, triggering a re-render and updating balance
                        onChange={(e) => setPaymentData({ ...paymentData, platform_fees: parseCurrencyInput(e.target.value) })}
                        className="w-full mt-1"
                        placeholder="₹0"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium">Payment Status</label>
                  <select
                    className="w-full border rounded p-2 mt-1"
                    value={paymentData.payment_status}
                    onChange={(e) => setPaymentData({ ...paymentData, payment_status: e.target.value as 'Pending' | 'Partial' | 'Settled' | 'Disputed' })}
                  >
                    {['Pending', 'Partial', 'Settled', 'Disputed'].map(status => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Balance Amount</label>
                  <Input
                    type="text"
                    // Value updates in real-time based on paymentData changes
                    value={formatCurrency(getTripBalance())}
                    className="w-full mt-1 bg-gray-100 cursor-not-allowed"
                    readOnly
                    title="Balance updates in real-time as you enter values"
                  />
                </div>
                {error && <div className="text-red-700 text-sm">{error}</div>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPaymentModalOpen(false)} disabled={loading}>
                  Cancel
                </Button>
                <Button onClick={updatePayment} disabled={loading || !isModified}>
                  {loading ? 'Processing...' : 'Save'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>
      </main>
    </div>
  );
}