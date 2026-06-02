import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { FileText, GraduationCap, TrendingUp, Award, BookOpen, ArrowRight } from "lucide-react";
import { StatCard, ChartShell, CurveChart, RadialScore, DashboardHero } from "@/components/dashboard/CryptoCards";

export const Route = createFileRoute("/student/")({ component: StudentDash });

function StudentDash() {
  const { user } = useAuth();
  const { data: student } = useQuery({
    queryKey: ["my-student", user?.id],
    queryFn: async () => (await supabase.from("students").select("*, classes(name)").eq("user_id", user!.id).maybeSingle()).data,
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ["student-stats", student?.id],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("results").select("total, grade, subjects(name), terms(name), created_at")
        .eq("student_id", student!.id).order("created_at", { ascending: true });
      const list = rows ?? [];
      const avg = list.length ? list.reduce((s, r) => s + Number(r.total ?? 0), 0) / list.length : 0;
      const best = list.reduce((m, r) => Math.max(m, Number(r.total ?? 0)), 0);
      const pass = list.length ? (list.filter(r => Number(r.total ?? 0) >= 50).length / list.length) * 100 : 0;
      const byTerm: Record<string, number[]> = {};
      list.forEach(r => { const k = (r as any).terms?.name ?? "Term"; (byTerm[k] ??= []).push(Number(r.total ?? 0)); });
      const trend = Object.entries(byTerm).map(([x, arr]) => ({ x, y: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) }));
      const subjects = list.slice(-8).map((r, i) => ({ x: (r as any).subjects?.name?.slice(0, 8) ?? `#${i}`, y: Number(r.total ?? 0) }));
      return { avg, best, pass, trend, subjects, count: list.length };
    },
    enabled: !!student?.id,
  });

  const trend = stats?.trend?.length ? stats.trend : [{x:"T1",y:62},{x:"T2",y:68},{x:"T3",y:74}];
  const subjects = stats?.subjects?.length ? stats.subjects : [{x:"Math",y:72},{x:"Eng",y:68},{x:"Sci",y:81},{x:"Soc",y:65},{x:"ICT",y:88}];

  return (
    <div className="space-y-6">
      <DashboardHero badge={`Student · ${student?.admission_no ?? "—"}`} title={student?.full_name ?? "Welcome"} subtitle={`Class: ${(student as any)?.classes?.name ?? "Unassigned"} — track your academic performance live.`} />

      {!student && (
        <div className="stat-glass p-6 text-sm text-muted-foreground">Your student record is not yet linked. Contact admin.</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Overall Avg" value={(stats?.avg ?? 0).toFixed(1)} delta={3.4} icon={<TrendingUp className="size-4" />} accent="primary" />
        <StatCard label="Best Score" value={(stats?.best ?? 0).toFixed(0)} icon={<Award className="size-4" />} accent="accent" />
        <StatCard label="Pass Rate" value={`${Math.round(stats?.pass ?? 0)}%`} delta={5.1} icon={<GraduationCap className="size-4" />} accent="success" />
        <StatCard label="Subjects Logged" value={stats?.count ?? 0} icon={<BookOpen className="size-4" />} accent="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartShell title="Performance Curve" subtitle="Average across terms">
            <CurveChart data={trend} />
          </ChartShell>
        </div>
        <ChartShell title="Academic Health" subtitle="Pass rate">
          <RadialScore value={stats?.pass ?? 0} label="Pass" />
        </ChartShell>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartShell title="Subject Breakdown" subtitle="Most recent results">
          <CurveChart data={subjects} color="var(--accent)" height={220} />
        </ChartShell>
        <ChartShell title="Report Card" subtitle="Latest term report" right={<FileText className="size-4 text-accent" />}>
          <p className="mb-4 text-sm text-muted-foreground">Download, print or view your full Nigerian-standard term report card.</p>
          <Link to="/student/result" className="inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20">
            Open report card <ArrowRight className="size-4" />
          </Link>
        </ChartShell>
      </div>
    </div>
  );
}
