import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> } // ✅ Correctly typed as Promise
) {
  try {
    // Await the params Promise to resolve the `id`
    const { id } = await params;

    // Parse the request body
    const { truck_id } = await req.json();

    // Validate truck_id (assuming it's a UUID)
    if (!truck_id || typeof truck_id !== "string" || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(truck_id)) {
      return NextResponse.json({ success: false, error: "Invalid or missing truck_id" }, { status: 400 });
    }

    // Update indent with selected truck and new status
    const { data, error } = await supabase
      .from("indents")
      .update({
        status: "assigned",
        selected_truck_id: truck_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id) // ✅ Use the resolved `id`
      .select();

    if (error) {
      console.error("Supabase error:", error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ success: false, error: "Indent not found or update failed" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: data[0] });
  } catch (err: any) {
    console.error("Unexpected error:", err.message);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}