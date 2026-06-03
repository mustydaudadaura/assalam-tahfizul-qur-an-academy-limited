import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Building2, CreditCard, Users, Activity } from "lucide-react";

export const Route = createFileRoute("/super/")({ component: SuperOverview });

function SuperOverview() {
  const { data: stats } = useQuery({
    queryKey: ["super-stats"],
    queryFn: async () => {
      const [schools, subs, users] = await Promise.all([
        supabase.from("schools").select("id,is_active"),
        supabase.from("school_subscriptions").select("plan,status,price_ngn"),
        supabase.from("user_roles").select("role"),
      ]);
      const active = (schools.data ?? []).filter(s => s.is_active).length;
      const mrr = (subs.data ?? []).filter(s => s.status === "active").reduce((a, b) => a + Number(b.price_ngn || 0), 0);
      return {
        schools: schools.data?.length ?? 0,
        active,
        mrr,
        users: users.data?.length ?? 0,
        planBreakdown: (subs.data ?? []).reduce((acc: Record<string, number>, s) => { acc[s.plan] = (acc[s.plan] ?? 0) + 1; return acc; }, {}),
      };
    },
  });

  const tiles = [
    { label: "Schools", value: stats?.schools ?? 0, icon: <Building2 className="size-5" />, to: "/super/schools" },
    { label: "Active tenants", value: stats?.active ?? 0, icon: <Activity className="size-5" />, to: "/super/schools" },
    { label: "MRR (NGN)", value: `₦${(stats?.mrr ?? 0).toLocaleString()}`, icon: <CreditCard className="size-5" />, to: "/super/subscriptions" },
    { label: "Total users", value: stats?.users ?? 0, icon: <Users className="size-5" />, to: "/super/admins" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Platform overview</h2>
        <p className="text-sm text-muted-foreground">SaaS health across every tenant.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(t => (
          <Link key={t.label} to={t.to}>
            <Card className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t.label}</span>
                <span className="text-primary">{t.icon}</span>
              </div>
              <div className="mt-2 font-display text-3xl font-bold">{t.value}</div>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="p-5">
        <h3 className="font-semibold mb-3">Plan distribution</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(stats?.planBreakdown ?? {}).map(([plan, count]) => (
            <span key={plan} className="rounded-full bg-primary/10 px-3 py-1 text-sm capitalize">{plan}: {count}</span>
          ))}
          {!Object.keys(stats?.planBreakdown ?? {}).length && <span className="text-sm text-muted-foreground">No subscriptions yet.</span>}
        </div>
      </Card>
    </div>
  );
}
