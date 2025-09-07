'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Navbar from '@/components/ui/Navbar';
import { X, History, Info, Pencil } from 'lucide-react';
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
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [isNewStatusSelected, setIsNewStatusSelected] = useState(false);
  const [tab, setTab] = useState('active');
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

    (async () => {
      try {
        const { data: t, error: tripError } = await supabase
          .from('trips')
          .select('*, indents!indent_id(*, clients(name), trip_cost, vehicle_number, vehicle_type, origin, destination, load_material, load_weight_kg, driver_phone, contact_phone), client_cost, short_id, status')
          .order('created_at', { ascending: false });
        if (tripError) {
          console.log('Supabase Error:', tripError);
          setError('Failed to load trips.');
          return;
        }
        setTrips(t || []);
      } catch (err) {
        console.log('Fetch Error:', err);
        setError('Failed to load data.');
      }
    })();
  }, [router]);

  const filteredTrips = useMemo(() => {
    const s = q.toLowerCase();
    const activeStates = ['created', 'started', 'in_transit', 'stopped'];

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
      case 'in_transit': return 'bg-yellow-100 text-yellow-800';
      case 'stopped': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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
                      <div className="grid grid-cols-2 divide-x divide-gray-200">
                        <div className="text-center px-2">
                          <p className="text-xs text-gray-500">Client Cost</p>
                          <p className="text-base font-bold text-gray-900">₹{i.client_cost || 0}</p>
                        </div>
                        <div className="text-center px-2">
                          <p className="text-xs text-gray-500">Trip Cost</p>
                          <p className="text-base font-bold text-gray-900">₹{i.indents?.trip_cost || 0}</p>
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
                    {['created', 'started', 'in_transit', 'stopped', 'completed', 'cancelled'].map(status => (
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
              <DialogFooter className="p-2">
                <Button variant="outline" onClick={() => setInfoModalOpen(false)} disabled={loading} className="text-sm px-3 py-1">
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>
      </main>
    </div>
  );
}