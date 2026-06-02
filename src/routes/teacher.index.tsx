import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { BookOpen, School, ClipboardList, CalendarCheck, ArrowRight } from "lucide-react";
import { StatCard, ChartShell, CurveChart, RadialScore, DashboardHero } from "@/components/dashboard/CryptoCards";

export const Route = createFileRoute("/teacher/")({ component: TeacherDash });

function spark(seed: number, n = 12) {
  const out = []; let v = 40 + (seed % 30);
  for (let i = 0; i < n; i++) { v += Math.sin(i + seed) * 6 + (Math.random() * 6 - 3); out.push({ x: i, y: Math.max(5, Math.round(v)) }); }
  return out;
}

function TeacherDash() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["teacher-dash", user?.id],
    queryFn: async () => {
      const [a, r] = await Promise.all([
        supabase.from("teacher_assignments").select("*, subjects(name), classes(name)").eq("teacher_id", user!.id),
        supabase.from("results").select("total, grade, created_at").eq("entered_by", user!.id).order("created_at", { ascending: false }).limit(300),
      ]);
      const rows = r.data ?? [];
      const avg = rows.length ? rows.reduce((s, x) => s + Number(x.total ?? 0), 0) / rows.length : 0;
      const pass = rows.length ? (rows.filter(x => Number(x.total ?? 0) >= 50).length / rows.length) * 100 : 0;
      const byMonth: Record<string, number[]> = {};
      rows.forEach(x => {
        const k = new Date(x.created_at).toLocaleDateString(undefined, { month: "short" });
        (byMonth[k] ??= []).push(Number(x.total ?? 0));
      });
      const trend = Object.entries(byMonth).slice(-8).map(([x, arr]) => ({ x, y: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) }));
      const buckets = ["A","B","C","D","F"].map(g => ({ x: g, y: rows.filter(x => x.grade === g).length }));
      return { assignments: a.data ?? [], avg, pass, trend, buckets, count: rows.length };
    },
    enabled: !!user,
  });

  const assignments = data?.assignments ?? [];
  const trend = data?.trend?.length ? data.trend : spark(7, 8).map((p, i) => ({ x: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug"][i], y: p.y }));
  const buckets = data?.buckets?.some(b => b.y) ? data.buckets : [{x:"A",y:8},{x:"B",y:14},{x:"C",y:10},{x:"D",y:4},{x:"F",y:2}];

  return (
    <div className="space-y-6">
      <DashboardHero badge="Educator console" title="Your classroom signal" subtitle="Track student outcomes across the subjects and classes you teach." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Subjects" value={new Set(assignments.map(a => a.subject_id)).size} icon={<BookOpen className="size-4" />} spark={spark(1)} accent="primary" />
        <StatCard label="Classes" value={new Set(assignments.map(a => a.class_id)).size} icon={<School className="size-4" />} spark={spark(2)} accent="accent" />
        <StatCard label="Scores Entered" value={data?.count ?? 0} delta={6.2} icon={<ClipboardList className="size-4" />} spark={spark(3)} accent="success" />
        <StatCard label="Average" value={(data?.avg ?? 0).toFixed(1)} delta={2.1} icon={<CalendarCheck className="size-4" />} spark={spark(4)} accent="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartShell title="Score Trend" subtitle="Class averages you've recorded">
            <CurveChart data={trend} />
          </ChartShell>
        </div>
        <ChartShell title="Pass Rate" subtitle="Across your entries">
          <RadialScore value={data?.pass ?? 0} label="Pass" />
        </ChartShell>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartShell title="Grade Mix" subtitle="A–F distribution">
          <CurveChart data={buckets} color="var(--accent)" height={220} />
        </ChartShell>
        <ChartShell title="Assignments" subtitle={`${assignments.length} active`} right={<Link to="/teacher/scores" className="inline-flex items-center gap-1 text-xs text-accent">Enter scores <ArrowRight className="size-3" /></Link>}>
          {!assignments.length ? (
            <p className="text-sm text-muted-foreground">No assignments yet. Ask admin to assign you subjects.</p>
          ) : (
            <ul className="space-y-2">
              {assignments.map(a => (
                <li key={a.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 p-3 text-sm">
                  <span className="font-medium">{(a as any).subjects?.name}</span>
                  <span className="rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs text-accent">{(a as any).classes?.name}</span>
                </li>
              ))}
            </ul>
          )}
        </ChartShell>
      </div>
    </div>
  );
}
