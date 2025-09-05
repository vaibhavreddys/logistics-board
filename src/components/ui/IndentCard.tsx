"use client";
import { useState } from "react";

export default function IndentCard({ indent }: { indent: any }) {
  const [loading, setLoading] = useState(false);

  const assignTruck = async () => {
    setLoading(true);
    const res = await fetch(`/api/indents/${indent.id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ truck_id: "11111111-1111-1111-1111-111111111111" }), // pick dummy truck
    });
    const result = await res.json();
    setLoading(false);
    if (result.success) {
      alert("Truck assigned!");
      window.location.reload(); // quick refresh for now
    } else {
      alert("Error: " + result.error);
    }
  };

  return (
    <div className="border rounded-xl p-4 shadow-sm">
      <h3 className="text-lg font-semibold">{indent.origin} → {indent.destination}</h3>
      <p>Vehicle: {indent.vehicle_type}</p>
      <p>Trip Cost: ₹{indent.trip_cost}</p>
      <p>Status: {indent.status}</p>

      {indent.status === "open" && (
        <button
          onClick={assignTruck}
          disabled={loading}
          className="mt-2 px-3 py-1 rounded bg-blue-600 text-white"
        >
          {loading ? "Assigning..." : "Assign Truck"}
        </button>
      )}
    </div>
  );
}
