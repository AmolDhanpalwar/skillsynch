import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { form_id, manager_id, manager_inputs, employee_id, reason } = await req.json();

    if (!form_id || !employee_id || !reason) {
      return new Response(
        JSON.stringify({ error: "form_id, employee_id, and reason are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Save manager inputs + mark form as returned
    const { error: updateError } = await supabase
      .from("skill_forms")
      .update({
        status: "returned",
        manager_id: manager_id ?? null,
        ...manager_inputs,
      })
      .eq("id", form_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Notify employee with the return reason
    const { error: notifError } = await supabase.from("notifications").insert({
      user_id: employee_id,
      type: "form_returned",
      message: `Your Skill Profile was returned for revision. Reason: ${reason}`,
      form_id,
    });

    if (notifError) {
      console.error("Notification insert failed:", notifError.message);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
