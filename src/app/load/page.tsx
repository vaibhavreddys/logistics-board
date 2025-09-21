'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, MessageCircle } from 'lucide-react';
import Navbar from '@/components/ui/Navbar';

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
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours() % 12 || 12;
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const period = d.getHours() >= 12 ? 'PM' : 'AM';
    return `${day}/${month}/${year} ${hours}:${minutes} ${period}`;
  } catch {
    return 'Invalid Date';
  }
};

// Client component with useSearchParams
function LoadPageContent() {
  const [indent, setIndent] = useState<Indent | null>(null);
  const searchParams = useSearchParams();
  const shortId = searchParams.get('id');

  useEffect(() => {
    const fetchData = async () => {
      if (!shortId) {
        console.error('No short_id provided in URL');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('indents')
          .select('*')
          .eq('short_id', shortId)
          .single();

        if (error) {
          console.error('Error fetching indent:', error.message);
          return;
        }
        setIndent(data);
      } catch (err) {
        console.error('Unexpected error fetching indent:', err);
      }
    };
    fetchData();
  }, [shortId]);

  if (!indent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
        <Navbar />
        <main className="max-w-6xl mx-auto p-6">
          <p className="text-gray-700">Loading or no indent found...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
      <Navbar />
      <main className="max-w-6xl mx-auto p-6">
        <Card className="overflow-hidden shadow-md hover:shadow-lg transition-shadow border border-gray-200 rounded-xl">
          <CardHeader className="!p-4 bg-gradient-to-r from-blue-600 to-purple-700 text-white flex justify-between">
            <h2 className="text-lg font-semibold self-start">{indent.origin} → {indent.destination}</h2>
            {indent.trip_cost > 0 && (
              <span className="text-md font-bold">
                ₹{Number(indent.trip_cost).toLocaleString()}
              </span>
            )}
          </CardHeader>
          <CardContent className="!p-4 space-y-3 text-sm text-gray-700">
            <div className="space-y-3 text-sm text-gray-700">
              <div className="flex items-baseline gap-2">
                <span className="text-gray-500 w-6 flex-shrink-0">🚚</span>
                <span className="w-20 font-medium flex-shrink-0">Vehicle:</span>
                <span className="font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md inline-flex items-center h-6">
                  {indent.vehicle_type}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-gray-500 w-6 flex-shrink-0">📦</span>
                <span className="w-20 font-medium flex-shrink-0">Load:</span>
                <span className="font-semibold">{indent.load_material || "—"} {indent.load_weight_kg ? `${indent.load_weight_kg} MT` : ""}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-gray-500 w-6 flex-shrink-0">📅</span>
                <span className="w-20 font-medium flex-shrink-0">Entry At:</span>
                <span>{formatDateDDMMYYYY(indent.pickup_at)}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-gray-500 w-6 flex-shrink-0">⏱</span>
                <span className="w-20 font-medium flex-shrink-0">TAT:</span>
                <span>{indent.tat_hours}h</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-gray-500 w-6 flex-shrink-0">🆔</span>
                <span className="w-20 font-medium flex-shrink-0">Load ID:</span>
                <span className="font-bold text-black-700 bg-blue-100 px-2 py-0.5 rounded-md inline-flex items-center h-6">
                  {indent.short_id}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <Button
                variant="default"
                className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
                onClick={() => window.location.href = `tel:${indent.contact_phone}`}
              >
                <Phone size={18} /> Contact
              </Button>
              <Button
                variant="outline"
                className="w-1/2 bg-green-500 hover:bg-green-600 text-white flex items-center justify-center gap-2"
                onClick={() => {
                  const loadDetails = [
                    `Load ID: *${indent.short_id}*`,
                    `Route: ${indent.origin} → ${indent.destination}`,
                    `Vehicle: ${indent.vehicle_type}`,
                    indent.load_material ? `Material: ${indent.load_material}` : null,
                    indent.load_weight_kg ? `Weight: ${indent.load_weight_kg} MT` : null,
                    `Pickup: ${formatDateDDMMYYYY(indent.pickup_at)}`,
                  ]
                    .filter(Boolean)
                    .join('\n');

                  const message = encodeURIComponent(`Hello,\nI'm interested in this load:\n\n${loadDetails}`);
                  window.open(`https://wa.me/+91${indent.contact_phone.replace(/^\+91/, '')}?text=${message}`, '_blank');
                }}
              >
                <MessageCircle size={18} /> WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function LoadPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
        <Navbar />
        <main className="max-w-6xl mx-auto p-6">
          <p className="text-gray-700">Loading...</p>
        </main>
      </div>
    }>
      <LoadPageContent />
    </Suspense>
  );
}