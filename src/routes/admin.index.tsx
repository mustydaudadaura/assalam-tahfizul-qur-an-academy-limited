import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Users, UserCog, School, BookOpen, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/admin/")({ component: AdminDash });

function AdminDash() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [s, t, c, sub, r] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "teacher"),
        supabase.from("classes").select("id", { count: "exact", head: true }),
        supabase.from("subjects").select("id", { count: "exact", head: true }),
        supabase.from("results").select("id", { count: "exact", head: true }),
      ]);
      return { students: s.count ?? 0, teachers: t.count ?? 0, classes: c.count ?? 0, subjects: sub.count ?? 0, results: r.count ?? 0 };
    },
  });

  const stats = [
    { label: "Students", value: data?.students ?? 0, icon: <Users />, color: "bg-blue-500/10 text-blue-600" },
    { label: "Teachers", value: data?.teachers ?? 0, icon: <UserCog />, color: "bg-emerald-500/10 text-emerald-600" },
    { label: "Classes", value: data?.classes ?? 0, icon: <School />, color: "bg-amber-500/10 text-amber-600" },
    { label: "Subjects", value: data?.subjects ?? 0, icon: <BookOpen />, color: "bg-violet-500/10 text-violet-600" },
    { label: "Results", value: data?.results ?? 0, icon: <ClipboardList />, color: "bg-rose-500/10 text-rose-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Welcome back</h2>
        <p className="text-sm text-muted-foreground">Quick overview of your institution.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <div className={`mb-3 flex size-10 items-center justify-center rounded-lg ${s.color}`}>{s.icon}</div>
            <div className="text-3xl font-bold font-display">{s.value}</div>
            <div className="text-sm text-muted-foreground">{s.label}</div>
          </Card>
        ))}
      </div>
      <Card className="p-6">
        <h3 className="font-display text-lg font-semibold">Getting started</h3>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Configure school details in <strong>Settings</strong>.</li>
          <li>Add <strong>Classes</strong> and <strong>Subjects</strong>.</li>
          <li>Register <strong>Students</strong> and assign them to classes.</li>
          <li>Create <strong>Teacher</strong> accounts and assign subjects/classes.</li>
          <li>Teachers enter CA & exam scores; results auto-compute totals, grades, and positions.</li>
        </ol>
      </Card>
    </div>
  );
}
