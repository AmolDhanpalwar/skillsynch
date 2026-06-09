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

    const { cycle_id } = await req.json();

    if (!cycle_id) {
      return new Response(
        JSON.stringify({ error: "cycle_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Mark cycle as active
    const { error: cycleError } = await supabase
      .from("review_cycles")
      .update({ status: "active", triggered_at: new Date().toISOString() })
      .eq("id", cycle_id)
      .eq("status", "draft");

    if (cycleError) {
      return new Response(
        JSON.stringify({ error: cycleError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Reset all skill_forms: link to new cycle, set status back to draft
    const { error: formsError } = await supabase
      .from("skill_forms")
      .update({
        cycle_id,
        status: "draft",
        submitted_at: null,
        approved_at: null,
        manager_review_date: null,
        updated_at: new Date().toISOString(),
      })
      .neq("id", "00000000-0000-0000-0000-000000000000"); // match all rows

    if (formsError) {
      return new Response(
        JSON.stringify({ error: formsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
