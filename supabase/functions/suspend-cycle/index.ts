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

    const { cycle_id, reason, user_id } = await req.json();

    if (!cycle_id || !reason || !user_id) {
      return new Response(
        JSON.stringify({ error: "cycle_id, reason, and user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Mark cycle as suspended
    const { error: cycleError } = await supabase
      .from("review_cycles")
      .update({
        status: "suspended",
        suspended_at: new Date().toISOString(),
        suspension_reason: reason.trim(),
        suspended_by: user_id,
      })
      .eq("id", cycle_id)
      .eq("status", "active");

    if (cycleError) {
      return new Response(
        JSON.stringify({ error: cycleError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get IDs of non-approved forms in this cycle (preserve approved forms)
    const { data: formsToDelete, error: fetchError } = await supabase
      .from("skill_forms")
      .select("id")
      .eq("cycle_id", cycle_id)
      .neq("status", "approved");

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formIds = (formsToDelete ?? []).map((f: { id: string }) => f.id);

    if (formIds.length > 0) {
      // 3. Delete skill_items for non-approved forms
      const { error: itemsError } = await supabase
        .from("skill_items")
        .delete()
        .in("form_id", formIds);

      if (itemsError) {
        return new Response(
          JSON.stringify({ error: itemsError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 4. Delete non-approved skill_forms
      const { error: deleteFormsError } = await supabase
        .from("skill_forms")
        .delete()
        .in("id", formIds);

      if (deleteFormsError) {
        return new Response(
          JSON.stringify({ error: deleteFormsError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, purged_forms: formIds.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
