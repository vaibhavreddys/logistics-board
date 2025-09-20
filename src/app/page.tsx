'use client';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Phone, MessageCircle } from 'lucide-react';
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

// Function to format time since posted
const formatAge = (createdAt: string): string => {
  try {
    const now = new Date();
    const posted = new Date(createdAt);
    if (isNaN(posted.getTime())) return 'Unknown';
    const diffMs = now.getTime() - posted.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 3600));
    const diffDays = Math.floor(diffMs / (1000 * 3600 * 24));

    if (diffMins < 60) {
      return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`;
    } else {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    }
  } catch {
    return 'Unknown';
  }
};

// Function to determine the section for an indent based on created_at
const getSection = (createdAt: string): string => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  const indentDate = new Date(createdAt);
  const diffTime = today.getTime() - indentDate.getTime();
  const diffDays = diffTime / (1000 * 3600 * 24);

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)
  startOfWeek.setHours(0, 0, 0, 0);

  if (indentDate >= today) {
    return 'Posted Today';
  } else if (indentDate >= startOfWeek) {
    return 'Posted This Week';
  } else {
    return 'Posted Before This Week';
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
          .order('created_at', { ascending: false }); // Sort by created_at descending
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
            return [row, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          } else if (payload.eventType === 'UPDATE') {
            if (row.status === 'open') {
              return prev.map(i => (i.id === row.id ? row : i)).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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

  // Group indents by section
  const groupedIndents = useMemo(() => {
    const groups: { [key: string]: Indent[] } = {
      'Posted Today': [],
      'Posted This Week': [],
      'Posted Before This Week': [],
    };

    filtered.forEach(indent => {
      const section = getSection(indent.created_at);
      groups[section].push(indent);
    });

    return groups;
  }, [filtered]);

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
        {['Posted Today', 'Posted This Week', 'Posted Before This Week'].map(section => (
          groupedIndents[section].length > 0 && (
            <div key={section} className="space-y-4">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold text-gray-800">{section}</h2>
                <div className="flex-1 h-px bg-gray-300"></div>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupedIndents[section].map(i => (
                  <Card key={i.id} className="overflow-hidden shadow-md hover:shadow-lg transition-shadow border border-gray-200 rounded-xl">
                    <CardHeader className="!p-4 bg-gradient-to-r from-blue-600 to-purple-700 text-white flex justify-between">
                      <h2 className="text-lg font-semibold self-start">{i.origin} → {i.destination}</h2>
                      <span className="text-xl font-bold self-start">{`₹${Number(i.trip_cost).toLocaleString()}`}</span>
                    </CardHeader>
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
                          <span className="text-gray-500 w-6 flex-shrink-0">⏳</span>
                          <span className="w-20 font-medium flex-shrink-0">Posted:</span>
                          <span>{formatAge(i.created_at)}</span>
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
                              .filter(Boolean)
                              .join('\n');
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
            </div>
          )
        ))}
      </main>
    </div>
  );
}