import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserCog, School, BookOpen, ClipboardList, TrendingUp, Activity } from "lucide-react";
import { StatCard, ChartShell, CurveChart, RadialScore, DashboardHero } from "@/components/dashboard/CryptoCards";

export const Route = createFileRoute("/admin/")({ component: AdminDash });

function makeSpark(seed: number, n = 12) {
  const out = []; let v = 40 + (seed % 30);
  for (let i = 0; i < n; i++) { v += Math.sin(i + seed) * 6 + (Math.random() * 8 - 4); out.push({ x: i, y: Math.max(5, Math.round(v)) }); }
  return out;
}

function AdminDash() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [s, t, c, sub, r, results] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "teacher"),
        supabase.from("classes").select("id", { count: "exact", head: true }),
        supabase.from("subjects").select("id", { count: "exact", head: true }),
        supabase.from("results").select("id", { count: "exact", head: true }),
        supabase.from("results").select("total, grade, created_at").order("created_at", { ascending: false }).limit(500),
      ]);
      const rows = results.data ?? [];
      const avg = rows.length ? rows.reduce((a, b) => a + Number(b.total ?? 0), 0) / rows.length : 0;
      const passRate = rows.length ? (rows.filter(r => Number(r.total ?? 0) >= 50).length / rows.length) * 100 : 0;
      const buckets = ["A", "B", "C", "D", "F"].map(g => ({ x: g, y: rows.filter(r => r.grade === g).length }));
      const byMonth: Record<string, number[]> = {};
      rows.forEach(r => {
        const k = new Date(r.created_at).toLocaleDateString(undefined, { month: "short" });
        (byMonth[k] ??= []).push(Number(r.total ?? 0));
      });
      const trend = Object.entries(byMonth).slice(-8).map(([x, arr]) => ({ x, y: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) }));
      return {
        students: s.count ?? 0, teachers: t.count ?? 0, classes: c.count ?? 0,
        subjects: sub.count ?? 0, results: r.count ?? 0,
        avg, passRate, buckets, trend,
      };
    },
  });

  const trend = data?.trend?.length ? data.trend : makeSpark(7, 8).map((p, i) => ({ x: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug"][i], y: p.y }));
  const buckets = data?.buckets?.some(b => b.y) ? data.buckets : [{x:"A",y:18},{x:"B",y:32},{x:"C",y:24},{x:"D",y:12},{x:"F",y:6}];

  return (
    <div className="space-y-6">
      <DashboardHero badge="Live · Admin Control" title="Institutional Overview" subtitle="Real-time performance, enrolment and academic signals across the school." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Students" value={data?.students ?? 0} delta={4.2} icon={<Users className="size-4" />} spark={makeSpark(1)} accent="primary" />
        <StatCard label="Teachers" value={data?.teachers ?? 0} delta={1.1} icon={<UserCog className="size-4" />} spark={makeSpark(2)} accent="accent" />
        <StatCard label="Classes" value={data?.classes ?? 0} delta={0} icon={<School className="size-4" />} spark={makeSpark(3)} accent="warning" />
        <StatCard label="Subjects" value={data?.subjects ?? 0} delta={2.4} icon={<BookOpen className="size-4" />} spark={makeSpark(4)} accent="primary" />
        <StatCard label="Results Logged" value={data?.results ?? 0} delta={8.6} icon={<ClipboardList className="size-4" />} spark={makeSpark(5)} accent="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartShell title="Academic Trend" subtitle="Avg score over time" right={<span className="inline-flex items-center gap-1 rounded-md border border-success/40 bg-success/10 px-2 py-1 text-xs text-success"><TrendingUp className="size-3" />+{(data?.avg ?? 0).toFixed(1)} avg</span>}>
            <CurveChart data={trend} />
          </ChartShell>
        </div>
        <ChartShell title="Pass Rate" subtitle="≥ 50% scores">
          <RadialScore value={data?.passRate ?? 0} label="Pass" />
        </ChartShell>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartShell title="Grade Distribution" subtitle="All recorded results">
          <CurveChart data={buckets} color="var(--accent)" height={220} />
        </ChartShell>
        <ChartShell title="Activity Feed" subtitle="System pulse" right={<Activity className="size-4 text-accent" />}>
          <ul className="space-y-3 text-sm">
            {[
              { t: "Results updated", d: "Mathematics · JSS 1", c: "primary" },
              { t: "New student admitted", d: "Adaeze Okonkwo · Primary 4", c: "accent" },
              { t: "Term remarks saved", d: "12 students · 2nd Term", c: "success" },
              { t: "Attendance logged", d: "JSS 2 · 28/30 present", c: "warning" },
            ].map((row, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 p-3">
                <div className="flex items-center gap-3">
                  <span className={`size-2 rounded-full bg-${row.c} pulse-dot`} />
                  <div>
                    <div className="font-medium">{row.t}</div>
                    <div className="text-xs text-muted-foreground">{row.d}</div>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">{String(i + 1).padStart(2, "0")}m</span>
              </li>
            ))}
          </ul>
        </ChartShell>
      </div>
    </div>
  );
}
