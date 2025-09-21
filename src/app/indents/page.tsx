'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Navbar from '@/components/ui/Navbar';
import { Checkbox } from '@/components/ui/checkbox';
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"

import { X, Pencil, History, Truck, Package, Phone, Calendar, Handshake, MessageSquareText, User, Edit, MessageCircle, MessageCircleCode } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function IndentsPage() {
  const [form, setForm] = useState({
    client_id: '',
    origin: '',
    destination: '',
    vehicle_type: '',
    trip_cost: '',
    client_cost: '',
    tat_hours: '',
    load_material: '',
    load_weight_kg: '',
    pickup_at: '',
    contact_phone: '',
  });
  const [clients, setClients] = useState<any[]>([]);
  const [indents, setIndents] = useState<any[]>([]);
  const [history, setHistory] = useState<Record<string, any[]>>({});
  const [trucks, setTrucks] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [editingIndentId, setEditingIndentId] = useState<string | null>(null);
  const [statusFilters, setStatusFilters] = useState(() => {
    return 'open';
  });
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [commentsModalOpen, setCommentsModalOpen] = useState(false);
  const [selectedIndentId, setSelectedIndentId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [agentName, setAgentName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [comments, setComments] = useState('');
  const [isNewStatusSelected, setIsNewStatusSelected] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredTrucks, setFilteredTrucks] = useState<any[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<any[]>([]);
  const router = useRouter();
  const [isAgentPlaced, setIsAgentPlaced] = useState(false); // Checkbox state
  const [selectedAgentId, setSelectedAgentId] = useState(''); // Selected agent UUID
  const [agents, setAgents] = useState<any[]>([]); // List of truck agents
  const [agentSearchTerm, setAgentSearchTerm] = useState('');
  const formRef = useRef<HTMLDivElement>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [message, setMessageUrl] = useState<string | null>(null);
  const [useMyPhone, setUseMyPhone] = useState(false);
  const [userPhone, setUserPhone] = useState<string | null>(null);

  function log() {
    const now = new Date();
    const timestamp = `[${now.toISOString()}]`;
    console.log(timestamp, ...arguments);
  }

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          console.log('Auth error or no user:', userError?.message);
          router.push("/login?redirect=/indents");
          return;
        }
      } catch (err) {
        console.error('Unexpected error in checkAuth:', err);
        setError('An unexpected error occurred. Please try again.');
      }
    };
    checkAuth();

    const fetchData = async () => {
      try {
        // Step 1: Fetch "open" indents first
        // log("fetch open indents - start");
        const { data: openIndents, error: openIndentError } = await supabase
          .from('indents')
          .select('*, profiles!indents_created_by_fkey(full_name), clients!client_id(name), short_id')
          .eq('status', 'open')
          .order('created_at', { ascending: false });
          // log("fetch open indents - end");
        console.log('Fetched open indents:', openIndents?.length || 0); // Debug log
        if (openIndentError) {
          console.error('Error fetching open indents:', openIndentError.message);
          setError('Failed to load open indents.');
          return;
        }
        setIndents(openIndents || []);

        // log("fetch remaining indents - start");
        // Step 2: Fetch "accepted" and "cancelled" indents afterward
        const { data: otherIndents, error: otherIndentError } = await supabase
          .from('indents')
          .select('*, profiles!indents_created_by_fkey(full_name), clients!client_id(name), short_id')
          .in('status', ['accepted', 'cancelled'])
          .order('created_at', { ascending: false });
        // log("fetch remaining indents - end");
        if (otherIndentError) {
          console.error('Error fetching other indents:', otherIndentError.message);
          // Non-critical error, proceed with open indents
        }
        // Combine open and other indents, keeping open indents first
        setIndents((prev) => [...prev, ...(otherIndents || [])]);

        // log("fetch other data - start");
        // Step 3: Fetch other data (clients, agents, trucks) in parallel
        const [clientsResponse, agentsResponse, trucksResponse] = await Promise.all([
          supabase.from('clients').select('id,name'),
          supabase.from('profiles').select('id, full_name').eq('role', 'truck_agent').order('full_name', { ascending: true }),
          supabase.from('trucks').select('id, vehicle_number, vehicle_type, profiles!trucks_owner_id_fkey(id)').eq('active', true).order('vehicle_number', { ascending: true }),
        ]);
        // log("fetch other data - end");
        const { data: c } = clientsResponse;
        setClients(c || []);
        const { data: a } = agentsResponse;
        console.log('Fetched agents:', a, 'Count:', a?.length || 0); // Debug log
        setAgents(a || []);
        setFilteredAgents(a || []);
        const { data: t } = trucksResponse;
        console.log('Fetched trucks:', t, 'Count:', t?.length || 0); // Debug log
        setTrucks(t || []);
        setFilteredTrucks(t || []);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again.');
      }
    };

    fetchData();

    const fetchUserPhone = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setUserPhone(data?.phone || null);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch phone number');
      } finally {
        setLoading(false);
      }
    };

    fetchUserPhone();
  }, [router]);
  
  // Handle checkbox toggle
  const handleCheckboxChange = (checked: boolean) => {
    setUseMyPhone(checked);
    if (checked && userPhone) {
      setForm({ ...form, contact_phone: userPhone });
    } else {
      setForm({ ...form, contact_phone: '' }); // Clear input when unchecked
      setError(null);
    }
  };

  useEffect(() => {
    console.log('Truck Search term changed:', searchTerm); // Debug log
    if (searchTerm) {
      const filtered = trucks.filter(t =>
        t.vehicle_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.vehicle_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.profiles?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()));
        console.log('Filtered trucks count:', filtered.length, 'Results:', filtered.map(t => ({ vehicle_number: t.vehicle_number, owner_name: t.profiles?.full_name || 'Unknown' }))); // Debug log
      setFilteredTrucks(filtered);
    } else {
      setFilteredTrucks(trucks);
    }
  }, [searchTerm, trucks]);

  useEffect(() => {
    console.log('Agent Search term changed:', agentSearchTerm); // Debug log
    if (agentSearchTerm) {
      const filtered = agents.filter(t =>
        (t?.full_name || '').toLowerCase().includes(agentSearchTerm.toLowerCase()));
        console.log('Filtered agents count:', filtered.length, 'Results:', filtered.map(t => ({ agent_name: t?.full_name || 'Unknown' }))); // Debug log
      setFilteredAgents(filtered);
    } else {
      setFilteredAgents(agents);
    }
  }, [agentSearchTerm, agents]);

  interface ImageData {
    caption: string;
    rows: Array<{
      label: string;
      value: string;
      isBold?: boolean;
      fontSize?: number;
      color?: string;
    }>;
  }

  const generateTableImage = async (data: ImageData, setFeedback: (msg: string | null) => void, setImageSrc: (url: string | null) => void) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      const width = 450; // Increased width for better layout
      const height = 350; // Adjusted height for more rows and padding
      canvas.width = width * 2; // High DPI
      canvas.height = height * 2;
      ctx.scale(2, 2);

      // Modern Background and Border
      ctx.fillStyle = '#f9fafb'; // Light gray background
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#141617ff'; // Subtle gray border
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, width - 20, height - 20);

      // Table Header Styling
      ctx.fillStyle = '#6051abff'; // Blue header background
      ctx.fillRect(20, 30, width - 40, 30);
      ctx.fillStyle = '#ffffff'; // White text for header
      ctx.font = 'bold 14px Arial';
      ctx.fillText(data.rows[1].value, 30, 50);

      // Table Rows with Dynamic Styling
      const rowHeight = 30;
      const startY = 100;
      let itemCount = 0;
      data.rows.forEach((row, index) => {
        console.log(row.label);
        console.log(row.value);
        if (row.label === "Route") return;
        if (row.value === "NA") return;
        const y = startY + (itemCount++ * rowHeight);
        const fontSize = row.fontSize || 12;
        const isBold = itemCount == 0;
        const color = '#071625ff';

        // Label
        ctx.font = `${isBold ? 'bold' : 'normal'} ${fontSize}px Arial`;
        ctx.fillStyle = '#0b0b0cff'; // Gray for labels
        ctx.fillText(row.label, 30, y);

        // Value
        ctx.font = `${isBold ? 'bold' : 'normal'} ${fontSize}px Arial`;
        ctx.fillStyle = color; // Dynamic color for values
        ctx.fillText(row.value || '—', 200, y); // Adjusted x for better alignment
      });

      // Convert to blob and handle display
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png');
      });

      if (!blob) throw new Error('Failed to create image blob');

      // This is for laptops
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setFeedback(`Image copied to clipboard! (Indent: ${data.rows[0].value})`);
        setTimeout(() => setFeedback(null), 3000);
      // } else {
      }
        // This if mobile phones
        const url = URL.createObjectURL(blob);
        console.log(url);
        setImageSrc(url);
        if (!(navigator.clipboard && window.isSecureContext)) {
          setFeedback('Image generated! Long-press to copy.');
          setTimeout(() => setFeedback(null), 3000);
        }
      // }

    } catch (error) {
      console.error('Error generating table image:', error);
      setFeedback('Failed to generate image. Please try again.');
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const validateForm = () => {
    if (!form.client_id) return 'Please select a client.';
    if (!form.origin) return 'Please enter an origin.';
    if (!form.destination) return 'Please enter a destination.';
    if (!form.vehicle_type) return 'Please select a vehicle type.';
    if (!form.pickup_at) return 'Please select a placement date and time.';
    if (!form.contact_phone || !/^\d{10}$/.test(form.contact_phone)) return 'Please enter a valid 10-digit contact phone number.';
    return null;
  };

  const generateShortId = async (origin: string, destination: string) => {
    const prefix = `${origin.charAt(0)}${destination.charAt(0)}`.toUpperCase();
    const { data: existingIndents, error: countError } = await supabase
      .from('indents')
      .select('short_id')
      .ilike('short_id', `${prefix}%`);
    if (countError) {
      console.error('Error counting existing indents:', countError.message);
      return `${prefix}0001`; // Fallback to 0001 if count fails
    }
    const maxNumber = existingIndents.reduce((max, indent) => {
      const num = parseInt(indent.short_id?.slice(2) || '0');
      return num > max ? num : max;
    }, 0);
    const nextNumber = String(maxNumber + 1).padStart(4, '0');
    return `${prefix}${nextNumber}`;
  };

  const createIndent = async () => {
    setLoading(true);
    try {
      setError(null);
      setSuccess(null);

      const validationError = validateForm();
      if (validationError) {
        setError(validationError);
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('No authenticated user:', userError?.message);
        setError('You must be logged in to create an indent.');
        router.push('/login');
        return;
      }

      const shortId = await generateShortId(form.origin, form.destination);
      const payload: any = {
        ...form,
        created_by: user.id,
        trip_cost: Number(form.trip_cost || 0),
        client_cost: Number(form.client_cost || 0),
        tat_hours: Number(form.tat_hours || 0),
        load_weight_kg: form.load_weight_kg ? Number(form.load_weight_kg) : null,
        pickup_at: form.pickup_at ? new Date(form.pickup_at).toISOString() : null,
        status: 'open',
        short_id: shortId, // Add short_id to payload
      };

      const { data: indent, error: indentError } = await supabase
        .from('indents')
        .insert(payload)
        .select('*, profiles!indents_created_by_fkey(full_name), clients!client_id(name), short_id')
        .single();
      if (indentError) {
        console.error('Error creating indent:', indentError.message);
        setError(`Failed to create indent: ${indentError.message}`);
        return;
      }

      const { error: historyError } = await supabase
        .from('indent_status_history')
        .insert({
          indent_id: indent.id,
          to_status: 'open',
          changed_by: user.id,
          remark: 'Indent created',
        });

      if (historyError) {
        console.error('Error creating status history:', historyError.message);
        setError(`Failed to record status history: ${historyError.message}`);
        return;
      }

      setIndents(prev => [indent, ...prev]);
      setHistory(prev => ({
        ...prev,
        [indent.id]: [{ id: indent.id, to_status: 'open', changed_by: user.id, remark: 'Indent created', changed_at: new Date().toISOString() }],
      }));
      setForm({
        client_id: '',
        origin: '',
        destination: '',
        vehicle_type: '',
        trip_cost: '',
        client_cost: '',
        tat_hours: '',
        load_material: '',
        load_weight_kg: '',
        pickup_at: '',
        contact_phone: '',
      });
      setEditingIndentId(null);
      setSuccess('Indent created successfully!');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Unexpected error creating indent:', err);
      setError('An unexpected error occurred while creating the indent.');
    } finally {
      setLoading(false);
    }
  };

  const updateIndent = async () => {
    setLoading(true);
    try {
      setError(null);
      setSuccess(null);

      const validationError = validateForm();
      if (validationError) {
        setError(validationError);
        return;
      }

      if (!editingIndentId) {
        setError('No indent selected for editing.');
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('No authenticated user:', userError?.message);
        setError('You must be logged in to update an indent.');
        router.push('/login');
        return;
      }

      const payload: any = {
        client_id: form.client_id,
        origin: form.origin,
        destination: form.destination,
        vehicle_type: form.vehicle_type,
        trip_cost: Number(form.trip_cost || 0),
        client_cost: Number(form.client_cost || 0),
        tat_hours: Number(form.tat_hours || 0),
        load_material: form.load_material,
        load_weight_kg: form.load_weight_kg ? Number(form.load_weight_kg) : null,
        pickup_at: form.pickup_at ? new Date(form.pickup_at).toISOString() : null,
        contact_phone: form.contact_phone,
        updated_at: new Date().toISOString(),
      };

      const { data: indent, error: indentError } = await supabase
        .from('indents')
        .update(payload)
        .eq('id', editingIndentId)
        .select('*, profiles!indents_created_by_fkey(full_name), clients!client_id(name), short_id')
        .single();
      if (indentError) {
        console.error('Error updating indent:', indentError.message);
        setError(`Failed to update indent: ${indentError.message}`);
        return;
      }

      setIndents(prev => prev.map(i => (i.id === editingIndentId ? indent : i)));
      setForm({
        client_id: '',
        origin: '',
        destination: '',
        vehicle_type: '',
        trip_cost: '',
        client_cost: '',
        tat_hours: '',
        load_material: '',
        load_weight_kg: '',
        pickup_at: '',
        contact_phone: '',
      });
      setEditingIndentId(null);
      setSuccess('Indent updated successfully!');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Unexpected error updating indent:', err);
      setError('An unexpected error occurred while updating the indent.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (indent: any) => {
    setForm({
      client_id: indent.client_id || '',
      origin: indent.origin || '',
      destination: indent.destination || '',
      vehicle_type: indent.vehicle_type || '',
      trip_cost: indent.trip_cost?.toString() || '',
      client_cost: indent.client_cost?.toString() || '',
      tat_hours: indent.tat_hours?.toString() || '',
      load_material: indent.load_material || '',
      load_weight_kg: indent.load_weight_kg?.toString() || '',
      pickup_at: indent.pickup_at ? new Date(indent.pickup_at).toISOString().slice(0, 16) : '',
      contact_phone: indent.contact_phone || '',
    });
    setEditingIndentId(indent.id);
    if (formRef.current) formRef.current.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setForm({
      client_id: '',
      origin: '',
      destination: '',
      vehicle_type: '',
      trip_cost: '',
      client_cost: '',
      tat_hours: '',
      load_material: '',
      load_weight_kg: '',
      pickup_at: '',
      contact_phone: '',
    });
    setEditingIndentId(null);
  };

  const toggleStatusFilter = (status: string) => {
    setStatusFilters(status === statusFilters ? '' : status); // Toggle off if same, else set new status
    console.log('Status filter set to:', status === statusFilters ? 'none' : status); // Debug log
  };

  const formatStatus = (status: string, remark: string) => {
    if (status === 'open' && remark === 'Indent created') return 'Created';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const updateStatus = async () => {
    setLoading(true);
    try {
      const validationError = validateStatusUpdate();
      if (validationError) {
        setError(validationError);
        return;
      }
      setError(null);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('No authenticated user:', userError?.message);
        setError('You must be logged in to update indent status.');
        return;
      }

      const currentIndent = indents.find(i => i.id === selectedIndentId);
      if (!currentIndent) {
        console.error('Indent not found:', selectedIndentId);
        setError('Indent not found.');
        return;
      }

      if (currentIndent.status === newStatus) {
        console.log('Status unchanged, skipping update:', newStatus);
        setStatusModalOpen(false);
        return;
      }

      const payload: any = { 
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (newStatus === 'accepted' && vehicleNumber && driverPhone) {
        payload.vehicle_number = vehicleNumber;
        payload.driver_phone = driverPhone;
        console.log('Creating trip with:', { indent_id: selectedIndentId, vehicleNumber, isAgentPlaced, selectedAgentId }); // Debug log
        const selectedTruck = trucks.find(t => t.vehicle_number === vehicleNumber);
        if (!selectedTruck) {
          console.error('Selected truck not found:', vehicleNumber);
          setError('Selected vehicle not found.');
          return;
        } else {
          console.log("Selected truck");
          console.log(selectedTruck)
        }
        const truckProviderId = isAgentPlaced && selectedAgentId ? selectedAgentId : selectedTruck.profiles?.id;
        console.log('Assigning truck_provider_id:', truckProviderId, 'Truck ID:', selectedTruck.id); // Debug log
        // Create trip with client_cost and short_id
        const { data: trip, error: tripError } = await supabase
          .from('trips')
          .insert({
            indent_id: selectedIndentId,
            client_cost: currentIndent.client_cost,
            short_id: currentIndent.short_id,
            truck_id: selectedTruck.id,
            truck_provider_id: truckProviderId,
            driver_phone: driverPhone
          })
          .select('id')
          .single();
        if (tripError) {
          console.error('Error creating trip:', tripError.message);
          setError(`Failed to create trip: ${tripError.message}`);
          return;
        } else {
          console.log("Updated trips table with " + {indent_id: selectedIndentId,
            client_cost: currentIndent.client_cost,
            short_id: currentIndent.short_id,
            truck_id: selectedTruck.id,
            truck_provider_id: truckProviderId})
        }
        payload.trip_id = trip.id;
      }
      if (comments) {
        payload.notes = comments;
      }

      const { error: updateError } = await supabase.from('indents').update(payload).eq('id', selectedIndentId);
      if (updateError) {
        console.error('Error updating indent status:', updateError.message);
        setError(`Failed to update indent status: ${updateError.message}`);
        return;
      }

      const remark = `status --> ${newStatus}${vehicleNumber ? `, Vehicle: ${vehicleNumber}` : ''}${driverPhone ? `, Driver Phone: ${driverPhone}` : ''}${comments ? `, Comments: ${comments}` : ''}`;
      const { error: historyError } = await supabase
        .from('indent_status_history')
        .insert({
          indent_id: selectedIndentId,
          to_status: newStatus,
          changed_by: user.id,
          remark: remark,
        });

      if (historyError) {
        console.error('Error updating status history:', historyError.message);
        setError(`Failed to record status history: ${historyError.message}`);
        return;
      }

      const { data: h, error: fetchError } = await supabase
        .from('indent_status_history')
        .select('*, profiles!indent_status_history_changed_by_fkey(full_name)')
        .eq('indent_id', selectedIndentId)
        .order('changed_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching updated history:', fetchError.message);
        setError(`Failed to fetch status history: ${fetchError.message}`);
        return;
      }

      const { data: updatedIndent } = await supabase
        .from('indents')
        .select('*, profiles!indents_created_by_fkey(full_name), clients!client_id(name), short_id')
        .eq('id', selectedIndentId)
        .single();

      setIndents(prev => prev.map(i => i.id === selectedIndentId ? updatedIndent : i));
      setHistory(prev => {
        if (selectedIndentId) {
          return { ...prev, [selectedIndentId]: h || [] };
        }
        return prev;
      });
      setSuccess('Status updated successfully!');
      setTimeout(() => setSuccess(null), 5000);
      setStatusModalOpen(false);
      setNewStatus('');
      setVehicleNumber('');
      setAgentName('');
      setDriverPhone('');
      setComments('');
      setIsNewStatusSelected(false);
      setSearchTerm('');
      setAgentSearchTerm('');
    } catch (err) {
      console.error('Error updating status:', err);
      setError('Failed to update indent status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateComments = async () => {
    setLoading(true);
    try {
      setError(null);
      setSuccess(null);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('No authenticated user:', userError?.message);
        setError('You must be logged in to update comments.');
        return;
      }

      const currentIndent = indents.find(i => i.id === selectedIndentId);
      if (!currentIndent) {
        console.error('Indent not found:', selectedIndentId);
        setError('Indent not found.');
        return;
      }

      const payload: any = {
        notes: comments,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase.from('indents').update(payload).eq('id', selectedIndentId);
      if (updateError) {
        console.error('Error updating comments:', updateError.message);
        setError(`Failed to update comments: ${updateError.message}`);
        return;
      }

      const { data: updatedIndent } = await supabase
        .from('indents')
        .select('*, profiles!indents_created_by_fkey(full_name), clients!client_id(name), short_id')
        .eq('id', selectedIndentId)
        .single();

      setIndents(prev => prev.map(i => i.id === selectedIndentId ? updatedIndent : i));
      setSuccess('Comments updated successfully!');
      setTimeout(() => setSuccess(null), 5000);
      setCommentsModalOpen(false);
      setComments('');
    } catch (err) {
      console.error('Error updating comments:', err);
      setError('Failed to update comments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (indentId: string) => {
    setLoading(true);
    try {
      const { data: h, error: historyError } = await supabase
        .from('indent_status_history')
        .select('*, profiles!indent_status_history_changed_by_fkey(full_name)')
        .eq('indent_id', indentId)
        .order('changed_at', { ascending: false });
      if (historyError) {
        console.error('Error fetching history:', historyError.message);
        setError('Failed to load status history.');
        return;
      }
      setHistory(prev => ({ ...prev, [indentId]: h || [] }));
      setSelectedIndentId(indentId);
      setHistoryModalOpen(true);
    } catch (err) {
      console.error('Error fetching history:', err);
      setError('Failed to load status history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredIndents = useMemo(() => {
    const s = q.toLowerCase();
    return indents.filter(i =>
      (statusFilters === '' || statusFilters === i.status) &&
      [i.origin, i.destination, i.vehicle_type, i.clients?.name || ''].some(t => t.toLowerCase().includes(s))
    );
  }, [q, indents, statusFilters]);

  const validateStatusUpdate = () => {
    if (!newStatus) return 'Please select a status.';
    if (newStatus === 'accepted') {
      if (!vehicleNumber) return 'Please select a vehicle number.';
      if (!trucks.some(t => t.vehicle_number === vehicleNumber)) {
        return 'Selected vehicle number is not available.';
      }
      if (!driverPhone || !/^[6-9]\d{9}$/.test(driverPhone)) {
        return 'Please enter a valid 10-digit driver phone number, it should start between 6-9 and contain only 10 digits';
      }
      if (isAgentPlaced && !selectedAgentId) {
        return 'Please select an agent when vehicle is placed by agent.';
      }
      if (isAgentPlaced && !agents.some(a => a.id === selectedAgentId)) {
        return 'Selected agent is not valid.';
      }
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-100">
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
        {success && (
          <div className="bg-green-100 text-green-700 p-3 rounded mb-4 flex justify-between items-center animate-pulse z-50">
            {success}
            <button onClick={() => setSuccess(null)} className="text-green-700 hover:text-green-900">
              <X size={20} />
            </button>
          </div>
        )}
        <Card className="p-4 space-y-3" ref={formRef}>
          <h2 className="text-xl font-bold">{editingIndentId ? 'Editing Indent' : 'Create Indent'}</h2>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Client</Label>
              <select
                className="w-full border rounded p-2"
                value={form.client_id}
                onChange={e => setForm({ ...form, client_id: e.target.value })}
              >
                <option value="">Select client</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>From</Label>
              <Input value={form.origin} onChange={e => setForm({ ...form, origin: e.target.value })} />
            </div>
            <div>
              <Label>To</Label>
              <Input value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} />
            </div>
            <div>
              <Label>Vehicle Type</Label>
              <select
                className="w-full border rounded p-2"
                value={form.vehicle_type}
                onChange={e => setForm({ ...form, vehicle_type: e.target.value })}
              >
                <option value="">Select vehicle type</option>
                <option value="32 ft MXL">32 ft MXL (Multi Axle)</option>
                <option value="32 ft SXL">32 ft SXL (Single Axle)</option>
                <option value="24 ft Truck">24 ft Truck</option>
                <option value="20 ft Truck">20 ft Truck</option>
                <option value="22 ft Truck">22 ft Truck</option>
                <option value="17 ft Truck">17 ft Truck</option>
                <option value="14 ft Truck">14 ft Truck</option>
                <option value="10 ft (407)">10 ft Truck / Tata 407</option>
                <option value="8 ft (Bolero)">8 ft Pickup (Bolero / Pickup)</option>
                <option value="7 ft TataAce">7 ft Tata Ace</option>
              </select>
            </div>
            <div>
              <Label>Load Weight (MT)</Label>
              <Input
                type="number"
                value={form.load_weight_kg}
                onChange={e => setForm({ ...form, load_weight_kg: e.target.value })}
              />
            </div>
            <div>
              <Label>Load Material</Label>
              <Input value={form.load_material} onChange={e => setForm({ ...form, load_material: e.target.value })} />
            </div>
            <div>
              <Label>Client Cost (₹)</Label>
              <Input
                type="number"
                value={form.client_cost}
                onChange={e => setForm({ ...form, client_cost: e.target.value })}
              />
            </div>
            <div>
              <Label>Trip Cost (₹)</Label>
              <Input
                type="number"
                value={form.trip_cost}
                onChange={e => setForm({ ...form, trip_cost: e.target.value })}
              />
            </div>
            <div>
              <Label>TAT (hours)</Label>
              <Input
                type="number"
                value={form.tat_hours}
                onChange={e => setForm({ ...form, tat_hours: e.target.value })}
              />
            </div>
            <div>
              <Label>Placement Date & Time</Label>
              <Input
                type="datetime-local"
                value={form.pickup_at}
                onChange={e => setForm({ ...form, pickup_at: e.target.value })}
              />
            </div>
            <div>
              <Label>Contact Phone</Label>
              <Input
                type="text"
                value={form.contact_phone}
                disabled={useMyPhone}
                onChange={e => setForm({ ...form, contact_phone: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <Checkbox
                id="use_my_phone"
                checked={useMyPhone}
                onCheckedChange={handleCheckboxChange}
                disabled={loading || !userPhone}
              />
              <Label htmlFor="use_my_phone" className="text-gray-700">
                Use My Phone Number {userPhone ? `(${userPhone})` : '(Loading...)'}
              </Label>
          </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={editingIndentId ? updateIndent : createIndent} disabled={loading}>
              {loading ? 'Processing...' : (editingIndentId ? 'Update Indent' : 'Post to Load Board')}
            </Button>
            {editingIndentId && (
              <Button variant="outline" onClick={handleCancelEdit}>
                Cancel
              </Button>
            )}
          </div>
        </Card>

        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h2 className="text-xl font-bold">My Indents ({filteredIndents.length})</h2>
            <Input
              placeholder="Search city / vehicle / client"
              value={q}
              onChange={e => setQ(e.target.value)}
              className="max-w-sm"
            />
          </div>
          {isClient && (
            <div className="flex flex-wrap gap-2">
              {['open', 'accepted', 'cancelled'].map(status => (
                <Button
                  key={status}
                  variant={statusFilters === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleStatusFilter(status)}
                >
                  {formatStatus(status, '')}
                </Button>
              ))}
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-3">
            {filteredIndents.map(i => (
              <Card
                key={i.id}
                className="p-4 bg-white shadow-md hover:shadow-lg transition-shadow flex flex-col h-full">
                <div className="space-y-2 flex-grow">
                  {/* Title with Short ID */}
                  <div className="font-semibold text-lg text-gray-800">
                    {i.origin} ⮕ {i.destination} <span className="text-sm text-gray-500">(ID: {i.short_id})</span>
                  </div>

                  {/* Key-Value rows */}
                  <div className="border rounded-lg divide-y text-sm overflow-hidden">
                    {(i.vehicle_number || i.vehicle_type) && (
                      <div className="grid grid-cols-[auto,1fr] gap-x-2 px-3 py-2 hover:bg-gray-50 transition-colors items-center">
                        <div className="flex items-center text-gray-600 font-medium">
                          <Truck size={16} className="mr-2 text-gray-400" />
                          Vehicle
                        </div>
                        <div className="text-gray-800 font-semibold text-right break-words whitespace-pre-wrap">
                          {i.vehicle_number} {i.vehicle_type}
                        </div>
                      </div>
                    )}

                    {(i.load_weight_kg || i.load_material) && (
                      <div className="grid grid-cols-[auto,1fr] gap-x-2 px-3 py-2 hover:bg-gray-50 transition-colors items-center">
                        <div className="flex items-center text-gray-600 font-medium">
                          <Package size={16} className="mr-2 text-gray-400" />
                          Load
                        </div>
                        <div className="text-gray-800 font-semibold text-right break-words whitespace-pre-wrap">
                          {i.load_weight_kg} MT {i?.load_material}
                        </div>
                      </div>
                    )}

                    {i.driver_phone && (
                      <div className="grid grid-cols-[auto,1fr] gap-x-2 px-3 py-2 hover:bg-gray-50 transition-colors items-center">
                        <div className="flex items-center text-gray-600 font-medium">
                          <Phone size={16} className="mr-2 text-gray-400" />
                          Driver Phone
                        </div>
                        <div className="text-gray-800 font-semibold text-right break-words whitespace-pre-wrap">
                          {i.driver_phone}
                        </div>
                      </div>
                    )}

                    {i.pickup_at && (
                      <div className="grid grid-cols-[auto,1fr] gap-x-2 px-3 py-2 hover:bg-gray-50 transition-colors items-center">
                        <div className="flex items-center text-gray-600 font-medium">
                          <Calendar size={16} className="mr-2 text-gray-400" />
                          Placement At
                        </div>
                        <div className="text-gray-800 font-semibold text-right break-words whitespace-pre-wrap">
                          {new Date(i.pickup_at).toLocaleString()}
                        </div>
                      </div>
                    )}

                    {i.clients?.name && (
                      <div className="grid grid-cols-[auto,1fr] gap-x-2 px-3 py-2 hover:bg-gray-50 transition-colors items-center">
                        <div className="flex items-center text-gray-600 font-medium">
                          <User size={16} className="mr-2 text-gray-400" />
                          Client
                        </div>
                        <div className="text-gray-800 font-semibold text-right break-words whitespace-pre-wrap">
                          {i.clients.name}
                        </div>
                      </div>
                    )}

                    {i.trip_cost > 0 && (
                      <div className="grid grid-cols-[auto,1fr] gap-x-2 px-3 py-2 hover:bg-gray-50 transition-colors items-center">
                        <div className="flex items-center text-gray-600 font-medium">
                          <Handshake size={16} className="mr-2 text-gray-400" />
                          Trip Cost
                        </div>
                        <div className="text-gray-800 font-semibold text-right break-words whitespace-pre-wrap">
                          ₹{i.trip_cost}
                        </div>
                      </div>
                    )}

                    {i.client_cost > 0 && (
                      <div className="grid grid-cols-[auto,1fr] gap-x-2 px-3 py-2 hover:bg-gray-50 transition-colors items-center">
                        <div className="flex items-center text-gray-600 font-medium">
                          <Handshake size={16} className="mr-2 text-gray-400" />
                          Client Cost
                        </div>
                        <div className="text-gray-800 font-semibold text-right break-words whitespace-pre-wrap">
                          ₹{i.client_cost}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Full-width Comments row with edit icon */}
                  {i.notes && (
                    <div className="border rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start text-gray-600 font-small mb-1">
                        <MessageSquareText size={16} className="mr-2 mt-1 text-gray-400" />
                        Comments
                        <button
                          onClick={() => {
                            setSelectedIndentId(i.id);
                            setComments(i.notes || "");
                            setCommentsModalOpen(true);
                          }}
                          className="ml-2 mt-1 text-yellow-600 hover:text-yellow-800 focus:outline-none"
                          disabled={loading}
                        >
                          <Edit size={16} />
                        </button>
                      </div>
                      <div className="text-gray-800 font-semibold break-words whitespace-pre-wrap">
                        {i.notes}
                      </div>
                    </div>
                  )}
                </div>

                {/* Buttons + Status fixed at bottom */}
                <div className="mt-auto pt-4 flex justify-between items-end">
                  <div className="flex gap-3 mr-1">
                    {i.status !== 'cancelled' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-blue-600 border-blue-600 hover:bg-blue-50"
                        onClick={() => {
                          setSelectedIndentId(i.id);
                          setNewStatus(i.status);
                          setVehicleNumber(i.vehicle_number || "");
                          setAgentName(i.full_name || "")
                          setDriverPhone(i.driver_phone || "");
                          setComments(i.notes || "");
                          setStatusModalOpen(true);
                          setIsNewStatusSelected(false);
                        }}
                      >
                        {/* <span className="flex items-center">
                          <span className="hidden sm:inline">Update Status</span>
                        </span> */}
                        Update Status
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-green-600 border-green-600 hover:bg-green-50"
                      onClick={() => fetchHistory(i.id)}
                      disabled={loading}
                    >
                      <span className="flex items-center">
                        <History size={16} className="mr-1" />
                        {/* <span className="hidden sm:inline">View History</span> */}
                      </span>
                    </Button>
                    {i.status !== 'cancelled' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-purple-600 border-purple-600 hover:bg-purple-50"
                        onClick={() => handleEdit(i)}
                      >
                        <span className="flex items-center">
                          <Pencil size={16} className="mr-1" />
                          <span className="hidden sm:inline">Edit</span>
                        </span>
                      </Button>
                    )}
                    {i.status !== 'cancelled' && i.status !== 'accepted' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-600 border-green-600 hover:bg-green-50"
                        onClick={async () => {
                          const loadDetails = {
                            caption: `Checkout this load ${i.short_id}`,
                            rows: [
                              { label: 'Load ID', value: i.short_id },
                              { label: 'Route', value: `${i.origin} ⮕ ${i.destination}`, isBold: true, fontSize: 14 },
                              { label: 'Vehicle', value: i.vehicle_type || 'NA' },
                              { label: 'Load', value: i.load_weight_kg ? `${i.load_weight_kg} MT` : 'NA'},
                              { label: 'Material', value: `${i.load_material || ''}`.trim() || 'NA' },
                              { label: 'Placement At', value: i.pickup_at ? new Date(i.pickup_at).toLocaleString() : 'NA' },
                              { label: 'Client', value: i.clients?.name || 'NA' },
                              { label: 'Trip Cost', value: i.trip_cost ? `₹${i.trip_cost}` : 'NA' },
                            ],
                          };
                          console.log(loadDetails);
                          await generateTableImage(loadDetails, setFeedback, setImageSrc);

                          const subMessage = encodeURIComponent(`Interested in load *${i.short_id}*\n${i.origin} ⮕ ${i.destination}\n${i.vehicle_type}`);
                          const message = encodeURIComponent(`Hello,\nCheckout this load\n\nInterested? Chat here: https://wa.me/+91${i.contact_phone.replace(/^\+91/, '')}?text=${subMessage}\n\nFind more loads at https://freight24.in/\n\n`);
                          setMessageUrl(`https://wa.me/+91${i.contact_phone.replace(/^\+91/, '')}?text=${message}`);
                        }}
                      >
                        <MessageCircle size={16} />
                        <span className="hidden sm:inline">Share</span>
                      </Button>
                    )}

                  {/* // Add modal to display the image */}
                  {imageSrc && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                      <div className="bg-white p-4 rounded-lg">
                        <img src={imageSrc} alt="Load Details" style={{ maxWidth: '100%', maxHeight: '70vh' }} />
                        <span>Copy the image first and then click on "WhatsApp" button, paste the image before sending the message on WhatsApp.</span><br></br>
                        <span>The message will be sent to the person who created the indent, you can forward it to the vehicle provider's groups.</span><br></br>
                        <div className="mt-4 flex justify-between items-center">
                          <button
                            onClick={() => setImageSrc(null)}
                            className="bg-blue-500 text-white px-4 py-2 rounded flex-1"
                          >
                            Close
                          </button>
                          <button
                            onClick={() => {
                              if (message) {
                                console.log("Clicked WhatsApp button")
                                window.open(message);
                                // setMessageUrl(null);
                              } else {
                                setFeedback('Please generate the image first to set the message.');
                                setTimeout(() => setFeedback(null), 3000);
                              }
                            }}
                            className="bg-green-500 text-white px-4 py-2 rounded flex-1 flex items-center justify-center"
                          >
                            <MessageCircleCode size={16} className="mr-1" />
                            <span>WhatsApp</span> {/* Removed hidden sm:inline to always show text */}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {feedback && (
                    <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
                      {feedback}
                    </div>
                  )}
                  </div>
                  <span className="px-2 py-0.5 bg-blue-200 text-blue-900 rounded-lg text-lg font-semibold shadow-md">
                    {formatStatus(i.status, "")}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </section>

{/* <!-- [Previous code remains unchanged until the Dialog section] --> */}
<Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Update Indent Status</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      <div>
        <Label>New Status</Label>
        <select
          className="w-full border rounded p-2"
          value={newStatus}
          onChange={(e) => {
            setNewStatus(e.target.value);
            setVehicleNumber('');
            setDriverPhone('');
            setAgentName('');
            setIsAgentPlaced(false); // Reset checkbox
            setSelectedAgentId(''); // Reset agent selection
            setIsNewStatusSelected(e.target.value !== (indents.find(i => i.id === selectedIndentId)?.status || ''));
          }}
          disabled={loading}
        >
          {['open', 'accepted', 'cancelled'].map(status => (
            <option key={status} value={status} disabled={indents.find(i => i.id === selectedIndentId)?.status === status}>
              {formatStatus(status, '')}
            </option>
          ))}
        </select>
      </div>
      {newStatus === 'accepted' && (
        <>
          <div>
            <Label>Vehicle Number</Label>
            <Input
              type="text"
              value={searchTerm || vehicleNumber || ''} // Display selected value if no search term
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (vehicleNumber && !e.target.value.startsWith(vehicleNumber)) {
                  setVehicleNumber(''); // Clear selection if user starts typing something else
                }
              }}
              placeholder="Search vehicle number or type or owner/agent name..."
              className="w-full border rounded p-2 mb-2"
              autoComplete="off"
            />
            {searchTerm && (
              <div className="border rounded max-h-40 overflow-y-auto bg-white shadow-md z-10">
                {filteredTrucks.length > 0 ? (
                  filteredTrucks.map(t => (
                    <div
                      key={t.vehicle_number}
                      className="p-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => {
                        console.log('Selected vehicle details:', {
                          vehicle_number: t.vehicle_number,
                          vehicle_type: t.vehicle_type,
                          owner_name: t.profiles?.full_name || 'Unknown'
                        });
                        setVehicleNumber(t.vehicle_number);
                        setSearchTerm('');
                        setStatusModalOpen(true);
                      }}
                    >
                      {t.vehicle_number} ({t.vehicle_type}, {t.profiles?.full_name || 'Unknown'})
                    </div>
                  ))
                ) : (
                  <div className="p-2 text-gray-500">
                    No matching vehicles found.{' '}
                    <Link href="/trucks" className="text-blue-600 hover:underline" onClick={() => setStatusModalOpen(false)}>
                      Add a new vehicle
                    </Link>.
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <Label>Driver Phone</Label>
            <Input
              type="text"
              value={driverPhone}
              onChange={e => {setError(null); setDriverPhone(e.target.value);}}
              disabled={loading}
              maxLength={10}
            />
          </div>
          <div>
            <Label className="flex items-center">
              <input
                type="checkbox"
                checked={isAgentPlaced}
                onChange={(e) => {
                  setIsAgentPlaced(e.target.checked);
                  console.log('Agent placed checkbox:', e.target.checked); // Debug log
                  if (!e.target.checked) {
                    setSelectedAgentId(''); // Reset agent if unchecked
                    setAgentName('');
                  }
                }}
                disabled={loading || !vehicleNumber}
                className="mr-2"
              />                      Vehicle placed by agent
            </Label>
          </div>
          {isAgentPlaced && (
            <div>
              <Label>Select Agent</Label>
              <Input
              type="text"
              value={agentSearchTerm || agentName || ''} // Display selected value if no search term
              onChange={(e) => {
                setAgentSearchTerm(e.target.value);
                if (agentName && !e.target.value.startsWith(agentName)) {
                  setAgentName(''); // Clear selection if user starts typing something else
                }
              }}
              placeholder="Search agent name..."
              className="w-full border rounded p-2 mb-2"
              autoComplete="off"
            />
            {agentSearchTerm && (
              <div className="border rounded max-h-40 overflow-y-auto bg-white shadow-md z-10">
                {filteredAgents.length > 0 ? (
                  filteredAgents.map(t => (
                    <div
                      key={t.full_name}
                      className="p-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => {
                        console.log('Selected agent name:', {
                          agent_name: t.full_name
                        });
                        setAgentName(t.full_name);
                        setSelectedAgentId(t.id);
                        setAgentSearchTerm('');
                        setStatusModalOpen(true);
                      }}
                    >
                      {t?.full_name || 'Unknown'}
                    </div>
                  ))
                ) : (
                  <div className="p-2 text-gray-500">
                    No agent found.{' '}
                    <Link href="/truck-owners?returnTo=/indents" className="text-blue-600 hover:underline" onClick={() => setStatusModalOpen(false)}>
                      Add a new agent
                    </Link>.
                  </div>
                )}
              </div>
            )}
            </div>
          )}
        </>
      )}
      <div>
        <Label>Comments (Optional)</Label>
        <Input
          value={comments}
          onChange={e => setComments(e.target.value)}
          disabled={loading || !isNewStatusSelected}
          placeholder="Add any comments..."
        />
      </div>
      {error && <div className="text-red-700">{error}</div>}
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => { setStatusModalOpen(false); setError(null);}} disabled={loading}>
        Cancel
      </Button>
      <Button onClick={updateStatus} disabled={loading || !isNewStatusSelected}>
        {loading ? 'Processing...' : 'Update'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

{/* <!-- [Remaining code remains unchanged] --> */}

        <Dialog open={commentsModalOpen} onOpenChange={setCommentsModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Comments</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Comments</Label>
                <Input
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  disabled={loading}
                  placeholder="Enter comments..."
                />
              </div>
              {error && <div className="text-red-700">{error}</div>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCommentsModalOpen(false); setError(null); setComments(''); }} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={updateComments} disabled={loading}>
                {loading ? 'Processing...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Status History</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {(history[selectedIndentId || ''] || []).map((h, index) => (
                <div key={h.id} className={`p-2 rounded ${index === 0 ? 'bg-gray-100 font-bold' : 'bg-white'}`}>
                  <div className="text-sm text-gray-600">
                    {new Date(h.changed_at).toLocaleString()} — {formatStatus(h.to_status, h.remark)} by {h.profiles?.full_name || 'Unknown'}
                  </div>
                </div>
              ))}
              {(!history[selectedIndentId || ''] || history[selectedIndentId || ''].length === 0) && (
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
      </main>
    </div>
  );
}