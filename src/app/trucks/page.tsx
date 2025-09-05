'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Navbar from '@/components/ui/Navbar';

export default function Trucks() {
  const [rows, setRows] = useState<any[]>([]);
  const [vehicle_number, setVN] = useState('');
  const [vehicle_type, setVT] = useState('');
  const [capacity_kg, setCap] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setLoading(true);
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          console.error('Auth error or no user:', userError?.message);
          router.push('/login');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('Profile fetch error:', profileError.message);
          setError('Failed to fetch user profile. Please try again.');
          router.push('/');
          return;
        }

        if (profile?.role !== 'truck_owner' && profile?.role !== 'admin') {
          console.warn('User is not a truck_owner or an admin:', profile?.role);
          router.push('/');
          return;
        }

        // Fetch trucks data only if user is authenticated and has correct role
        const { data, error: trucksError } = await supabase
          .from('trucks')
          .select('*')
          .order('created_at', { ascending: false });

        if (trucksError) {
          console.error('Trucks fetch error:', trucksError.message);
          setError('Failed to fetch trucks. Please try again.');
        } else {
          setRows(data || []);
        }
      } catch (err) {
        console.error('Unexpected error in checkAuth:', err);
        setError('An unexpected error occurred. Please try again.');
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const add = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase.from('trucks').insert({
        vehicle_number,
        vehicle_type,
        capacity_kg: Number(capacity_kg) || null,
        owner_id: user.id,
      });

      if (error) {
        console.error('Error adding truck:', error.message);
        setError('Failed to add truck. Please try again.');
        return;
      }

      const { data: updatedData, error: fetchError } = await supabase
        .from('trucks')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching updated trucks:', fetchError.message);
        setError('Failed to refresh trucks list. Please try again.');
      } else {
        setRows(updatedData || []);
        setVN('');
        setVT('');
        setCap('');
      }
    } catch (err) {
      console.error('Unexpected error adding truck:', err);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <Card className="p-4 space-y-2">
          <h2 className="font-semibold">Register Truck</h2>
          <div className="grid md:grid-cols-3 gap-2">
            <Input
              placeholder="KA-01-AB-1234"
              value={vehicle_number}
              onChange={e => setVN(e.target.value)}
            />
            <Input
              placeholder="32ft SXL Container"
              value={vehicle_type}
              onChange={e => setVT(e.target.value)}
            />
            <Input
              placeholder="Capacity (kg)"
              type="number"
              value={capacity_kg}
              onChange={e => setCap(e.target.value)}
            />
          </div>
          <Button onClick={add}>Add Truck</Button>
        </Card>

        <div className="grid md:grid-cols-2 gap-3">
          {rows.map(r => (
            <Card key={r.id} className="p-3">{r.vehicle_number} • {r.vehicle_type} • {r.capacity_kg || '—'} kg</Card>
          ))}
        </div>
      </main>
    </div>
  );
}