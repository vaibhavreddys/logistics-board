import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const {
      email,
      password,
      full_name,
      aadhaar_or_pan,
      bank_account_number,
      bank_ifsc_code,
      upi_id,
    } = await request.json();

    // Validate required fields
    if (!email || !password || !full_name || !aadhaar_or_pan) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create user with service role
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'Failed to create user' },
        { status: 400 }
      );
    }

    // Insert into profiles
    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      full_name,
      role: 'truck_owner',
    });
    if (profileError) {
      // Rollback user creation
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: profileError.message || 'Failed to create profile' },
        { status: 400 }
      );
    }

    // Insert into truck_owners
    const { error: truckOwnerError } = await supabase.from('truck_owners').insert({
      profile_id: authData.user.id,
      aadhaar_or_pan,
      bank_account_number: bank_account_number || null,
      bank_ifsc_code: bank_ifsc_code || null,
      upi_id: upi_id || null,
    });
    if (truckOwnerError) {
      // Rollback user and profile
      await supabase.from('profiles').delete().eq('id', authData.user.id);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: truckOwnerError.message || 'Failed to create truck owner' },
        { status: 400 }
      );
    }

    return NextResponse.json({ userId: authData.user.id }, { status: 200 });
  } catch (err: any) {
    console.error('Error in POST /api/truck-owners:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}