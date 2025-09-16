import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid'; // Import UUID generator

export async function POST(request: Request) {
  const data = await request.json();
  const { full_name, phone, role, aadhaar_or_pan, bank_account_number, bank_ifsc_code, upi_id, town_city } = data;

  try {
    // Generate a new UUID for the profile and user
    const userId = uuidv4();

    // Create a new user via Supabase Auth (simulating email/password creation)
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: `${userId}@example.com`, // Temporary email (update as needed)
      password: uuidv4(), // Temporary password (update as needed)
      user_metadata: { full_name, phone },
      email_confirm: true, // Auto-confirm for simplicity (adjust for production)
    });
    if (userError) throw userError;

    // Create profile
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({ id: userData.user.id, full_name, phone, role })
      .select('id')
      .single();
    if (profileError) throw profileError;

    // Create truck_owner
    const { data: truckOwnerData, error: truckOwnerError } = await supabaseAdmin
      .from('truck_owners')
      .insert({
        profile_id: profileData.id,
        aadhaar_or_pan,
        bank_account_number,
        bank_ifsc_code,
        upi_id,
        town_city,
      })
      .select('id');
    if (truckOwnerError) throw truckOwnerError;

    return NextResponse.json({ userId: profileData.id });
  } catch (err: any) {
    console.error('Error in POST /api/truck-owners:', err); // Added logging
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}