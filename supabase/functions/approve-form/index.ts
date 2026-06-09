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

    const { form_id, manager_id, manager_inputs, cycle_id, employee_id, cycle_name, approved_by } = await req.json();

    if (!form_id || !employee_id || !cycle_id) {
      return new Response(
        JSON.stringify({ error: "form_id, employee_id, and cycle_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();

    // 1. Save manager inputs + approve the form
    const { error: updateError } = await supabase
      .from("skill_forms")
      .update({
        status: "approved",
        approved_at: now,
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

    // 2. Fetch the fully updated form + skill_items for snapshot
    const { data: formSnap, error: snapFetchError } = await supabase
      .from("skill_forms")
      .select("*, skill_items(*)")
      .eq("id", form_id)
      .maybeSingle();

    if (snapFetchError || !formSnap) {
      return new Response(
        JSON.stringify({ error: snapFetchError?.message ?? "Form not found after update" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Upsert immutable snapshot into skill_form_versions
    const { error: versionError } = await supabase
      .from("skill_form_versions")
      .upsert(
        {
          cycle_id,
          form_id,
          employee_id,
          snapshot: formSnap,
          approved_at: now,
          approved_by: approved_by ?? null,
        },
        { onConflict: "employee_id,cycle_id", ignoreDuplicates: false }
      );

    if (versionError) {
      return new Response(
        JSON.stringify({ error: versionError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Notify employee
    const { error: notifError } = await supabase.from("notifications").insert({
      user_id: employee_id,
      type: "form_approved",
      message: cycle_name
        ? `Your Skill Profile for "${cycle_name}" has been approved.`
        : "Your Skill Profile has been approved.",
      form_id,
    });

    if (notifError) {
      // Non-fatal — log but don't fail the request
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
