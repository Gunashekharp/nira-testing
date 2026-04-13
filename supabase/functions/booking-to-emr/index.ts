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

  const { patientId, doctorId, clinicId, scheduledTime, type, chiefComplaint } = await req.json();

  // 1. Create encounter in Supabase
  const { data: encounter, error } = await supabase.from("encounters").insert({
    patient_id: patientId,
    doctor_id: doctorId,
    clinic_id: clinicId,
    scheduled_time: scheduledTime,
    type: type || "opd",
    status: "planned",
    chief_complaint: chiefComplaint,
  }).select().single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });

  // 2. (Optional) Create FHIR Encounter via HAPI proxy if configured
  const hapiUrl = Deno.env.get("HAPI_FHIR_URL");
  if (hapiUrl) {
    try {
      await fetch(`${hapiUrl}/fhir/Encounter`, {
        method: "POST",
        headers: { "Content-Type": "application/fhir+json" },
        body: JSON.stringify({
          resourceType: "Encounter",
          status: "planned",
          class: { code: type || "AMB" },
          subject: { reference: `Patient/${patientId}` },
          participant: [{ individual: { reference: `Practitioner/${doctorId}` } }],
        }),
      });
    } catch (e) {
      console.error("HAPI FHIR sync failed:", e.message);
    }
  }

  // 3. Broadcast to doctor queue (realtime already via postgres_changes, but also explicit broadcast)
  await supabase.channel("doctor-queue").send({
    type: "broadcast",
    event: "new_booking",
    payload: { encounterId: encounter.id, patientId, scheduledTime },
  });

  return new Response(JSON.stringify(encounter), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
