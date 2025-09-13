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
    advance_payment: 0,
    final_payment: 0,
    toll_charges: 0,
    halting_charges: 0,
    traffic_fines: 0,
    handling_charges: 0,
    platform_fees: 0,
    platform_fines: 0,
    payment_status: 'Pending' as const,
  });
  const [showDeductions, setShowDeductions] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
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

      const payload = { status: newStatus, updated_at: new Date().toISOString() };
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

  const formatCurrency = (num: number | null | undefined) => {
    if (!num) return "₹0";
    return "₹" + num.toLocaleString("en-IN");
  };

  const calculateBalance = (trip: any) => {
    const tripCost = trip.indents?.trip_cost || 0;
    const deductions = [
      trip.trip_payments?.advance_payment || 0,
      trip.trip_payments?.final_payment || 0,
      trip.trip_payments?.toll_charges || 0,
      trip.trip_payments?.halting_charges || 0,
      trip.trip_payments?.traffic_fines || 0,
      trip.trip_payments?.handling_charges || 0,
      trip.trip_payments?.platform_fees || 0,
      trip.trip_payments?.platform_fines || 0,
    ].reduce((a, b) => a + Number(b), 0);
    return tripCost - deductions;
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            </TabsList>

            <TabsContent value={tab} className="mt-2">
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
                          <span className="text-xs text-indigo-200">{new Date(i.created_at).toLocaleDateString()}</span>

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
                            {/* <p className="text-xs text-gray-500">Client Cost</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatCurrency(i.client_cost)}
                            </p> */}
                            <p className="text-xs text-gray-500">Final Amount Paid</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatCurrency(i.trip_payments?.final_payment )}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Trip Cost</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatCurrency(i?.indents?.trip_cost || 0)}
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
                            <p className="text-xs text-gray-500">Advance Paid</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatCurrency(i.trip_payments?.advance_payment || 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Charges</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatCurrency(
                                [
                                  i.trip_payments?.toll_charges,
                                  i.trip_payments?.halting_charges,
                                  i.trip_payments?.traffic_fines,
                                  i.trip_payments?.handling_charges,
                                  i.trip_payments?.platform_fees,
                                  i.trip_payments?.platform_fines,
                                ].filter(Boolean).reduce((a, b) => a + Number(b), 0)
                              )}
                            </p>
                          </div>
                        </div>
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
                      setNewStatus(e.target.value);
                      setIsNewStatusSelected(e.target.value !== (trips.find(i => i.id === selectedTripId)?.status || ''));
                    }}
                    disabled={loading}
                  >
                    {['created', 'started', 'paused', 'stopped', 'completed', 'cancelled'].map(status => (
                      <option key={status} value={status} disabled={trips.find(i => i.id === selectedTripId)?.status === status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
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
              <div className="p-2 max-h-[70vh] overflow-y-auto">
                {selectedTripId && (
                  <table className="w-full text-sm border-collapse">
                    <tbody>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Trip ID</td>
                        <td className="py-1">{trips.find(i => i.id === selectedTripId)?.short_id || 'N/A'}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Origin</td>
                        <td className="py-1">{trips.find(i => i.id === selectedTripId)?.indents?.origin || 'N/A'}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Destination</td>
                        <td className="py-1">{trips.find(i => i.id === selectedTripId)?.indents?.destination || 'N/A'}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Vehicle Number</td>
                        <td className="py-1">{trips.find(i => i.id === selectedTripId)?.indents?.vehicle_number || 'N/A'}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Vehicle Type</td>
                        <td className="py-1">{trips.find(i => i.id === selectedTripId)?.indents?.vehicle_type || 'N/A'}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Load</td>
                        <td className="py-1">{trips.find(i => i.id === selectedTripId)?.indents?.load_material || 'N/A'}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Weight</td>
                        <td className="py-1">{trips.find(i => i.id === selectedTripId)?.indents?.load_weight_kg || 'N/A'} kg</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Driver Phone</td>
                        <td className="py-1">{trips.find(i => i.id === selectedTripId)?.indents?.driver_phone || 'N/A'}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Contact Phone</td>
                        <td className="py-1">{trips.find(i => i.id === selectedTripId)?.indents?.contact_phone || 'N/A'}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Client Name</td>
                        <td className="py-1">{trips.find(i => i.id === selectedTripId)?.indents?.clients?.name || 'N/A'}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Client Cost</td>
                        <td className="py-1">₹{trips.find(i => i.id === selectedTripId)?.client_cost || 0}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Trip Cost</td>
                        <td className="py-1">₹{trips.find(i => i.id === selectedTripId)?.indents?.trip_cost || 0}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Advance Amount Paid</td>
                        <td className="py-1">₹{trips.find(i => i.id === selectedTripId)?.trip_payments?.advance_payment || 0}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Final Amount Paid</td>
                        <td className="py-1">₹{trips.find(i => i.id === selectedTripId)?.trip_payments?.final_payment || 0}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
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
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Balance Amount</td>
                        <td className="py-1">₹{calculateBalance(trips.find(i => i.id === selectedTripId) || { indents: {}, trip_payments: {} })}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Status</td>
                        <td className="py-1">{trips.find(i => i.id === selectedTripId)?.status || 'N/A'}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="font-medium pr-2 py-1 bg-gray-50">Created At</td>
                        <td className="py-1">{new Date(trips.find(i => i.id === selectedTripId)?.created_at).toLocaleString() || 'N/A'}</td>
                      </tr>
                    </tbody>
                  </table>
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
                      setPaymentData({
                        advance_payment: trip.trip_payments.advance_payment || 0,
                        final_payment: trip.trip_payments.final_payment || 0,
                        toll_charges: trip.trip_payments.toll_charges || 0,
                        halting_charges: trip.trip_payments.halting_charges || 0,
                        traffic_fines: trip.trip_payments.traffic_fines || 0,
                        handling_charges: trip.trip_payments.handling_charges || 0,
                        platform_fees: trip.trip_payments.platform_fees || 0,
                        platform_fines: trip.trip_payments.platform_fines || 0,
                        payment_status: trip.trip_payments.payment_status || 'Pending',
                      });
                    }
                    setPaymentModalOpen(true);
                  }}
                  disabled={loading}
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
                <DialogTitle>Update Payment Details</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="text-sm font-medium">Advance Payment</label>
                  <Input
                    type="number"
                    value={paymentData.advance_payment}
                    onChange={(e) => setPaymentData({ ...paymentData, advance_payment: Number(e.target.value) })}
                    className="w-full mt-1"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Final Payment</label>
                  <Input
                    type="number"
                    value={paymentData.final_payment}
                    onChange={(e) => setPaymentData({ ...paymentData, final_payment: Number(e.target.value) })}
                    className="w-full mt-1"
                    min="0"
                    step="0.01"
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
                      <label className="text-sm font-medium">Toll Charges</label>
                      <Input
                        type="number"
                        value={paymentData.toll_charges}
                        onChange={(e) => setPaymentData({ ...paymentData, toll_charges: Number(e.target.value) })}
                        className="w-full mt-1"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Halting Charges</label>
                      <Input
                        type="number"
                        value={paymentData.halting_charges}
                        onChange={(e) => setPaymentData({ ...paymentData, halting_charges: Number(e.target.value) })}
                        className="w-full mt-1"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Traffic Fines</label>
                      <Input
                        type="number"
                        value={paymentData.traffic_fines}
                        onChange={(e) => setPaymentData({ ...paymentData, traffic_fines: Number(e.target.value) })}
                        className="w-full mt-1"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Handling Charges</label>
                      <Input
                        type="number"
                        value={paymentData.handling_charges}
                        onChange={(e) => setPaymentData({ ...paymentData, handling_charges: Number(e.target.value) })}
                        className="w-full mt-1"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Platform Fees</label>
                      <Input
                        type="number"
                        value={paymentData.platform_fees}
                        onChange={(e) => setPaymentData({ ...paymentData, platform_fees: Number(e.target.value) })}
                        className="w-full mt-1"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Platform Fines</label>
                      <Input
                        type="number"
                        value={paymentData.platform_fines}
                        onChange={(e) => setPaymentData({ ...paymentData, platform_fines: Number(e.target.value) })}
                        className="w-full mt-1"
                        min="0"
                        step="0.01"
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
                {error && <div className="text-red-700 text-sm">{error}</div>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPaymentModalOpen(false)} disabled={loading}>
                  Cancel
                </Button>
                <Button onClick={updatePayment} disabled={loading}>
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