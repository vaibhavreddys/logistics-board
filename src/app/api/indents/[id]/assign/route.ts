import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { truck_id } = await req.json();

    // Update indent with selected truck + new status
    const { data, error } = await supabase
      .from("indents")
      .update({
        status: "assigned",
        selected_truck_id: truck_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
