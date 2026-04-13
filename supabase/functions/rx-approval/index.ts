import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  );

  const { prescriptionId, action, doctorId } = await req.json();

  if (action === "approve") {
    const { data, error } = await supabase
      .from("medication_requests")
      .update({ status: "active", approved_at: new Date().toISOString() })
      .eq("id", prescriptionId)
      .select("*, patients(user_id)")
      .single();

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });

    // Update encounter to final
    await supabase
      .from("encounters")
      .update({ status: "final", completed_time: new Date().toISOString() })
      .eq("id", data.encounter_id);

    // Audit log
    await supabase.from("audit_log").insert({
      user_id: doctorId,
      action: "rx_approved",
      table_name: "medication_requests",
      record_id: prescriptionId,
      new_data: data,
    });

    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
});
