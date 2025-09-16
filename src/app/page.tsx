'use client';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Phone } from 'lucide-react';
import { MessageCircle } from 'lucide-react'; // Icon for WhatsApp
import Navbar from '@/components/ui/Navbar';
import { Button } from "@/components/ui/button";
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"

interface Indent {
  id: string;
  client_id: string;
  origin: string;
  destination: string;
  vehicle_type: string;
  trip_cost: number;
  tat_hours: number;
  load_material: string | null;
  load_weight_kg: number | null;
  pickup_at: string;
  contact_phone: string;
  status: string;
  created_at: string;
  updated_at: string;
  short_id: string;
}

// Custom function for dd/mm/yyyy HH:mm format
const formatDateDDMMYYYY = (date: string): string => {
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

// Custom function for dd/<month in English>/yyyy HH:mm format
const formatDateDDMonthYYYY = (date: string): string => {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';
    const day = String(d.getDate()).padStart(2, '0');
    const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getMonth()];
    const year = d.getFullYear();
    const hours = d.getHours() % 12 || 12; // Convert to 12-hour format
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const period = d.getHours() >= 12 ? 'PM' : 'AM';
    return `${day}/${month}/${year} ${hours}:${minutes} ${period}`;
  } catch {
    return 'Invalid Date';
  }
};

export default function LoadBoard() {
  const [indents, setIndents] = useState<Indent[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, error } = await supabase
          .from('indents')
          .select('*')
          .eq('status', 'open')
          .order('pickup_at');
        if (error) {
          console.error('Error fetching indents:', error.message);
          return;
        }
        setIndents(data || []);
      } catch (err) {
        console.error('Unexpected error fetching indents:', err);
      }
    };
    fetchData();

    const channel = supabase
      .channel('indents-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'indents', filter: 'status=eq.open' }, (payload) => {
        setIndents(prev => {
          const row = payload.new as Indent;
          if (payload.eventType === 'INSERT' && row.status === 'open') {
            return [row, ...prev];
          } else if (payload.eventType === 'UPDATE') {
            if (row.status === 'open') {
              return prev.map(i => (i.id === row.id ? row : i));
            } else {
              return prev.filter(i => i.id !== row.id);
            }
          } else if (payload.eventType === 'DELETE') {
            return prev.filter(i => i.id !== payload.old.id);
          }
          return prev;
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return indents.filter(i =>
      [i.origin, i.destination, i.vehicle_type, i.load_material || ''].some(t => t.toLowerCase().includes(s))
    );
  }, [q, indents]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
      <Navbar />
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-3xl font-extrabold text-gray-900">Available Loads</h1>
          <div className="flex gap-4">
            <Input
              placeholder="Search by city, vehicle, or material"
              value={q}
              onChange={e => setQ(e.target.value)}
              className="w-full sm:w-64 p-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(i => (
            <Card key={i.id} className="overflow-hidden shadow-md hover:shadow-lg transition-shadow border border-gray-200 rounded-xl">
              {/* Header */}
              <CardHeader className="!p-4 bg-gradient-to-r from-blue-600 to-purple-700 text-white flex justify-between">
                <h2 className="text-lg font-semibold self-start">{i.origin} → {i.destination}</h2>
                <span className="text-xl font-bold self-start">{`₹${Number(i.trip_cost).toLocaleString()}`}</span>
              </CardHeader>

              {/* Content */}
              <CardContent className="!p-4 space-y-3 text-sm text-gray-700">
                <div className="space-y-3 text-sm text-gray-700">
                  <div className="flex items-baseline gap-2">
                    <span className="text-gray-500 w-6 flex-shrink-0">🚚</span>
                    <span className="w-20 font-medium flex-shrink-0">Vehicle:</span>
                    <span className="font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md inline-flex items-center h-6">
                      {i.vehicle_type}
                    </span>
                  </div>
                  
                  <div className="flex items-baseline gap-2">
                    <span className="text-gray-500 w-6 flex-shrink-0">📦</span>
                    <span className="w-20 font-medium flex-shrink-0">Load:</span>
                    <span className="font-semibold">{i.load_material || "—"} {i.load_weight_kg ? `${i.load_weight_kg} MT` : ""}</span>
                  </div>
                  
                  <div className="flex items-baseline gap-2">
                    <span className="text-gray-500 w-6 flex-shrink-0">📅</span>
                    <span className="w-20 font-medium flex-shrink-0">Entry At:</span>
                    <span>{formatDateDDMMYYYY(i.pickup_at)}</span>
                  </div>
                  
                  <div className="flex items-baseline gap-2">
                    <span className="text-gray-500 w-6 flex-shrink-0">⏱</span>
                    <span className="w-20 font-medium flex-shrink-0">TAT:</span>
                    <span>{i.tat_hours}h</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-gray-500 w-6 flex-shrink-0">🆔</span>
                    <span className="w-20 font-medium flex-shrink-0">Load ID:</span>
                    <span className="font-bold text-black-700 bg-blue-100 px-2 py-0.5 rounded-md inline-flex items-center h-6">
                      {i.short_id}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="default"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
                    onClick={() => window.location.href = `tel:${i.contact_phone}`}
                  >
                    <Phone size={18} /> Contact
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white flex items-center justify-center gap-2"
                    onClick={() => {
                      const loadDetails = [
                        `Load ID: *${i.short_id}*`,
                        `Route: ${i.origin} → ${i.destination}`,
                        `Vehicle: ${i.vehicle_type}`,
                        i.load_material ? `Material: ${i.load_material}` : null,
                        i.load_weight_kg ? `Weight: ${i.load_weight_kg} MT` : null,
                        `Pickup: ${formatDateDDMMYYYY(i.pickup_at)}`,
                      ]
                        .filter(Boolean) // Remove null/undefined values
                        .join('\n'); // Join with newlines for WhatsApp formatting

                      const message = encodeURIComponent(`Hello,\nI'm interested in this load:\n\n${loadDetails}`);
                      window.open(`https://wa.me/+91${i.contact_phone.replace(/^\+91/, '')}?text=${message}`, '_blank');
                    }}
                  >
                    <MessageCircle size={18} /> WhatsApp
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}