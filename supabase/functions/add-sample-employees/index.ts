import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const newEmployees = [
  {
    email: "employee3@haptiq.com",
    password: "emp@123",
    full_name: "Employee Three",
    role: "employee",
    employee_number: "EMP003",
    designation: "Software Engineer",
    grade: "L3",
  },
  {
    email: "employee4@haptiq.com",
    password: "emp@123",
    full_name: "Employee Four",
    role: "employee",
    employee_number: "EMP004",
    designation: "Senior Software Engineer",
    grade: "L4",
  },
  {
    email: "employee5@haptiq.com",
    password: "emp@123",
    full_name: "Employee Five",
    role: "employee",
    employee_number: "EMP005",
    designation: "Senior Software Engineer",
    grade: "L4",
  },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const results: Record<string, string> = {};

    for (const emp of newEmployees) {
      // Skip if auth user already exists
      const { data: existing } = await supabase
        .from("users")
        .select("id")
        .eq("email", emp.email)
        .maybeSingle();

      if (existing) {
        results[emp.email] = "already_exists";
        continue;
      }

      const { data, error } = await supabase.auth.admin.createUser({
        email: emp.email,
        password: emp.password,
        email_confirm: true,
        user_metadata: { full_name: emp.full_name, role: emp.role },
      });

      if (error) {
        results[emp.email] = `error: ${error.message}`;
        continue;
      }

      if (data.user) {
        await supabase
          .from("users")
          .update({
            employee_number: emp.employee_number,
            designation: emp.designation,
            grade: emp.grade,
          })
          .eq("id", data.user.id);

        results[emp.email] = "created";
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
