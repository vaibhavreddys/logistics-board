import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        full_name,
        phone,
        role,
        truck_owners (
          aadhaar_or_pan,
          bank_account_number,
          bank_ifsc_code,
          upi_id,
          town_city
        )
      `)
      .eq('role', 'truck_owner');
    if (profileError) {
      console.error('Error fetching profiles:', profileError.message);
      return NextResponse.json({ error: 'Failed to load truck owners' }, { status: 500 });
    }

    const truckOwners = [];
    for (const profile of profiles) {
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);
      if (userError || !userData.user) {
        console.error('Error fetching user email:', userError?.message, 'ID:', profile.id);
        continue;
      }
      truckOwners.push({
        id: profile.id,
        full_name: profile.full_name || 'Unknown',
        phone: profile.phone || null,
        email: userData.user.email || '',
        aadhaar_or_pan: profile.truck_owners?.aadhaar_or_pan || '',
        bank_account_number: profile.truck_owners?.bank_account_number || null,
        bank_ifsc_code: profile.truck_owners?.bank_ifsc_code || null,
        upi_id: profile.truck_owners?.upi_id || null,
        town_city: profile.truck_owners?.town_city || null,
      });
    }

    return NextResponse.json(truckOwners);
  } catch (err: any) {
    console.error('Unexpected error in GET /api/truck-owners/view:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}