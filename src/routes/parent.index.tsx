import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Users, TrendingUp, Award, GraduationCap, Bell } from "lucide-react";
import { StatCard, ChartShell, CurveChart, RadialScore, DashboardHero } from "@/components/dashboard/CryptoCards";

export const Route = createFileRoute("/parent/")({ component: ParentDash });

function ParentDash() {
  const { user } = useAuth();

  // Match guardian by phone or email on student record
  const { data: children } = useQuery({
    queryKey: ["my-children", user?.id, user?.email],
    queryFn: async () => {
      const email = user?.email ?? "";
      const { data } = await supabase
        .from("students")
        .select("id, full_name, admission_no, classes(name)")
        .or(`guardian_phone.eq.${email},guardian_name.ilike.%${email}%`);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ["parent-stats", children?.map(c => c.id).join(",")],
    queryFn: async () => {
      if (!children?.length) return null;
      const { data: rows } = await supabase
        .from("results").select("student_id, total, grade, created_at, subjects(name)")
        .in("student_id", children.map(c => c.id))
        .order("created_at", { ascending: true });
      const list = rows ?? [];
      const avg = list.length ? list.reduce((s, r) => s + Number(r.total ?? 0), 0) / list.length : 0;
      const pass = list.length ? (list.filter(r => Number(r.total ?? 0) >= 50).length / list.length) * 100 : 0;
      const best = list.reduce((m, r) => Math.max(m, Number(r.total ?? 0)), 0);
      const byMonth: Record<string, number[]> = {};
      list.forEach(r => { const k = new Date(r.created_at).toLocaleDateString(undefined, { month: "short" }); (byMonth[k] ??= []).push(Number(r.total ?? 0)); });
      const trend = Object.entries(byMonth).slice(-8).map(([x, arr]) => ({ x, y: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) }));
      const perChild = children.map(c => {
        const arr = list.filter(r => r.student_id === c.id);
        const a = arr.length ? arr.reduce((s, r) => s + Number(r.total ?? 0), 0) / arr.length : 0;
        return { x: c.full_name.split(" ")[0], y: Math.round(a) };
      });
      return { avg, pass, best, trend, perChild, count: list.length };
    },
    enabled: !!children?.length,
  });

  const trend = stats?.trend?.length ? stats.trend : [{x:"Jan",y:60},{x:"Feb",y:64},{x:"Mar",y:70},{x:"Apr",y:73}];
  const perChild = stats?.perChild?.length ? stats.perChild : [{x:"Child A",y:74},{x:"Child B",y:66}];

  return (
    <div className="space-y-6">
      <DashboardHero badge="Parent · Family Console" title="Your children, at a glance" subtitle="Performance, attendance signals and academic alerts for everyone in your household." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Children" value={children?.length ?? 0} icon={<Users className="size-4" />} accent="primary" />
        <StatCard label="Combined Avg" value={(stats?.avg ?? 0).toFixed(1)} delta={2.6} icon={<TrendingUp className="size-4" />} accent="accent" />
        <StatCard label="Top Score" value={(stats?.best ?? 0).toFixed(0)} icon={<Award className="size-4" />} accent="success" />
        <StatCard label="Pass Rate" value={`${Math.round(stats?.pass ?? 0)}%`} delta={4.1} icon={<GraduationCap className="size-4" />} accent="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartShell title="Household Trend" subtitle="Average across children">
            <CurveChart data={trend} />
          </ChartShell>
        </div>
        <ChartShell title="Pass Rate" subtitle="All recorded results">
          <RadialScore value={stats?.pass ?? 0} label="Pass" />
        </ChartShell>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartShell title="Per-child Average" subtitle="Compare performance">
          <CurveChart data={perChild} color="var(--accent)" height={220} />
        </ChartShell>
        <ChartShell title="Children" subtitle={`${children?.length ?? 0} linked`} right={<Bell className="size-4 text-accent" />}>
          {!children?.length ? (
            <p className="text-sm text-muted-foreground">No children linked yet. Ensure the school admin recorded your contact on each child's profile.</p>
          ) : (
            <ul className="space-y-2">
              {children.map(c => (
                <li key={c.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 p-3 text-sm">
                  <div>
                    <div className="font-medium">{c.full_name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{c.admission_no}</div>
                  </div>
                  <span className="rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs text-accent">{(c as any).classes?.name ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </ChartShell>
      </div>
    </div>
  );
}
