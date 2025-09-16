'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Navbar from '@/components/ui/Navbar';
import { User, CreditCard, Phone, X } from 'lucide-react';
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"

interface TruckOwnerForm {
  full_name: string;
  phone: string;
  aadhaar_or_pan: string;
  bank_account_number: string;
  bank_ifsc_code: string;
  upi_id: string;
  town_city: string;
  role: 'truck_owner' | 'truck_agent' | '';
}

export default function TruckOwnersPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/trucks';
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<TruckOwnerForm>({
    defaultValues: {
      full_name: '',
      phone: '',
      aadhaar_or_pan: '',
      bank_account_number: '',
      bank_ifsc_code: '',
      upi_id: '',
      town_city: '',
      role: '', // Empty default value for role
    }
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('Checking auth...'); // Debug log
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        console.log('Auth response:', { user, userError }); // Debug log
        if (userError || !user) {
          console.log('Auth error or no user:', userError?.message);
          router.push('/login');
          return;
        }
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        console.log('Profile response:', { profile, profileError }); // Debug log
        if (profileError || profile?.role !== 'admin') {
          console.error('Profile fetch error:', profileError?.message, 'Role:', profile?.role);
          router.push('/');
        }
      } catch (err) {
        console.error('Unexpected error in checkAuth:', err);
        setError('An unexpected error occurred. Please try again.');
      }
    };
    checkAuth();
  }, [router]);

  const handleAddTruckOwner = async (data: TruckOwnerForm) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      console.log('Submitting data:', data); // Debug log
      // Convert empty bank_ifsc_code to null to satisfy the check constraint
      const processedData = {
        ...data,
        bank_ifsc_code: data.bank_ifsc_code.trim() === '' ? null : data.bank_ifsc_code,
      };
      console.log('Processed data for API:', processedData); // Additional debug log
      const response = await fetch('/api/truck-owners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(processedData),
      });
      console.log('Fetch response status:', response.status); // Debug log
      const result = await response.json();
      console.log('Fetch response data:', result); // Debug log
      if (!response.ok) {
        throw new Error(result.error || 'Failed to add truck owner');
      }
      const { userId } = result;
      if (!userId) {
        throw new Error('No user ID returned');
      }
      // Format role for display (e.g., "truck_owner" -> "truck owner")
      const formattedRole = data.role.replace('_', ' ');
      setSuccess(`Added ${data.full_name} as a ${formattedRole} successfully!`);
      reset(); // Reset form after successful submission
      setTimeout(() => {
        router.push(`${returnTo}?newOwnerId=${userId}`);
      }, 2000);
    } catch (err: any) {
      console.error('Error adding truck owner:', err);
      setError(err.message || 'Failed to add truck owner');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-6xl mx-auto p-4">
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4 flex justify-between items-center">
            {error}
            <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900">
              <X size={20} />
            </button>
          </div>
        )}
        {success && (
          <div className="bg-green-100 text-green-700 p-3 rounded mb-4 flex justify-between items-center animate-pulse">
            {success}
            <button onClick={() => setSuccess(null)} className="text-green-700 hover:text-green-900">
              <X size={20} />
            </button>
          </div>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Add Truck Owner / Agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit(handleAddTruckOwner)} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Name *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      id="full_name"
                      placeholder="Vaibhav S"
                      className="pl-10"
                      {...register('full_name', { required: 'Name is required' })}
                    />
                    {errors.full_name && <p className="text-red-500 text-sm">{errors.full_name.message}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      id="phone"
                      placeholder="+91 9876543210"
                      className="pl-10"
                      {...register('phone', {
                        required: 'Phone is required',
                        pattern: {
                          value: /^\+?[1-9]\d{9,14}$/,
                          message: 'Enter a valid phone number (e.g., +919876543210)',
                        },
                      })}
                    />
                    {errors.phone && <p className="text-red-500 text-sm">{errors.phone.message}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aadhaar_or_pan">Aadhaar or PAN *</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      id="aadhaar_or_pan"
                      placeholder="123456789012 or ABCDE1234F"
                      className="pl-10"
                      {...register('aadhaar_or_pan', {
                        required: 'Aadhaar or PAN is required',
                        pattern: {
                          value: /^[A-Z0-9]{10}$|^[0-9]{12}$/,
                          message: 'Enter a valid 12-digit Aadhaar or 10-character PAN',
                        },
                      })}
                    />
                    {errors.aadhaar_or_pan && <p className="text-red-500 text-sm">{errors.aadhaar_or_pan.message}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select
                    onValueChange={(value) => setValue('role', value as 'truck_owner' | 'truck_agent', { shouldValidate: true })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="truck_owner">Truck Owner</SelectItem>
                      <SelectItem value="truck_agent">Truck Agent</SelectItem>
                    </SelectContent>
                  </Select>
                  <input
                    type="hidden"
                    {...register('role', {
                      required: 'Role is required',
                      validate: (value) => ['truck_owner', 'truck_agent'].includes(value) || 'Invalid role selected',
                    })}
                  />
                  {errors.role && <p className="text-red-500 text-sm">{errors.role.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="town_city">Town/City</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      id="town_city"
                      placeholder="Kolar"
                      className="pl-10"
                      {...register('town_city')}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_account_number">Bank Account Number</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      id="bank_account_number"
                      placeholder="12345678901234"
                      className="pl-10"
                      {...register('bank_account_number')}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_ifsc_code">Bank IFSC Code</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      id="bank_ifsc_code"
                      placeholder="SBIN0001234"
                      className="pl-10"
                      {...register('bank_ifsc_code', {
                        pattern: {
                          value: /^[A-Z]{4}0[A-Z0-9]{6}$/,
                          message: 'Enter a valid IFSC code (e.g., SBIN0001234)',
                        },
                      })}
                    />
                    {errors.bank_ifsc_code && <p className="text-red-500 text-sm">{errors.bank_ifsc_code.message}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="upi_id">UPI ID</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      id="upi_id"
                      placeholder="vaibhav@upi"
                      className="pl-10"
                      {...register('upi_id')}
                    />
                  </div>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Adding...' : 'Add Truck Owner/Agent'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}