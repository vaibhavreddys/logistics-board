import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(
  req: Request,
  context: { params: { id: string } }
) {
  try {
    const { id } = context.params;  // ✅ Access params this way
    const { truck_id } = await req.json();

    if (
      !truck_id ||
      typeof truck_id !== "string" ||
      !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(truck_id)
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing truck_id" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("indents")
      .update({
        status: "assigned",
        selected_truck_id: truck_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select();

    if (error) {
      console.error("Supabase error:", error.message);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: false, error: "Indent not found or update failed" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: data[0] });
  } catch (err: any) {
    console.error("Unexpected error:", err.message);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
