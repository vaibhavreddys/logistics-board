import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ✅ Correct type
) {
  try {
    const { id } = await params; // ✅ Await the Promise to resolve `id`
    const { status } = await req.json(); // Assuming you're updating the status

    // Validate status if needed
    if (!status || typeof status !== "string") {
      return NextResponse.json(
        { success: false, error: "Invalid or missing status" },
        { status: 400 }
      );
    }

    // Update the indent status in Supabase
    const { data, error } = await supabase
      .from("indents")
      .update({
        status: status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id) // Use the resolved `id`
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