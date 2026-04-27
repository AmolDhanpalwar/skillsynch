import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const seedData = [
  {
    email: "employee1@haptiq.com",
    password: "emp@123",
    full_name: "Employee One",
    role: "employee",
    employee_number: "EMP001",
    designation: "Software Engineer",
    grade: "L2",
  },
  {
    email: "employee2@haptiq.com",
    password: "emp@123",
    full_name: "Employee Two",
    role: "employee",
    employee_number: "EMP002",
    designation: "Software Engineer",
    grade: "L2",
  },
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
  {
    email: "tmg1@haptiq.com",
    password: "tmg@123",
    full_name: "TMG One",
    role: "tmg",
    employee_number: "TMG001",
    designation: "Technical Manager",
    grade: "M1",
  },
  {
    email: "tmg2@haptiq.com",
    password: "tmg@123",
    full_name: "TMG Two",
    role: "tmg",
    employee_number: "TMG002",
    designation: "Technical Manager",
    grade: "M1",
  },
  {
    email: "mgmt@haptiq.com",
    password: "mgmt@123",
    full_name: "Management User",
    role: "management",
    employee_number: "MGT001",
    designation: "Head of Engineering",
    grade: "D1",
  },
  {
    email: "admin@haptiq.com",
    password: "admin@123",
    full_name: "System Admin",
    role: "admin",
    employee_number: "ADM001",
    designation: "System Administrator",
    grade: "A1",
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

    const { count } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    if (count && count > 0) {
      return new Response(
        JSON.stringify({ message: "Already seeded", count }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const createdIds: Record<string, string> = {};

    for (const user of seedData) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { full_name: user.full_name, role: user.role },
      });

      if (error) {
        console.error(`Failed to create ${user.email}:`, error.message);
        continue;
      }

      if (data.user) {
        createdIds[user.email] = data.user.id;
        await supabase
          .from("users")
          .update({
            employee_number: user.employee_number,
            designation: user.designation,
            grade: user.grade,
          })
          .eq("id", data.user.id);
      }
    }

    // Assign managers for employees
    const emp1Id = createdIds["employee1@haptiq.com"];
    const emp2Id = createdIds["employee2@haptiq.com"];
    const emp3Id = createdIds["employee3@haptiq.com"];
    const emp4Id = createdIds["employee4@haptiq.com"];
    const emp5Id = createdIds["employee5@haptiq.com"];
    const tmg1Id = createdIds["tmg1@haptiq.com"];
    const tmg2Id = createdIds["tmg2@haptiq.com"];

    if (emp1Id && tmg1Id) await supabase.from("users").update({ manager_id: tmg1Id }).eq("id", emp1Id);
    if (emp2Id && tmg1Id) await supabase.from("users").update({ manager_id: tmg1Id }).eq("id", emp2Id);
    if (emp3Id && tmg2Id) await supabase.from("users").update({ manager_id: tmg2Id }).eq("id", emp3Id);
    if (emp4Id && tmg2Id) await supabase.from("users").update({ manager_id: tmg2Id }).eq("id", emp4Id);
    if (emp5Id && tmg2Id) await supabase.from("users").update({ manager_id: tmg2Id }).eq("id", emp5Id);

    return new Response(
      JSON.stringify({ message: "Seeded successfully", users: createdIds }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
