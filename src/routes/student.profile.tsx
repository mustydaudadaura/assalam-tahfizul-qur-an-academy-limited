import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/student/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const [p, s] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
        supabase.from("students").select("*, classes(name)").eq("user_id", user!.id).maybeSingle(),
      ]);
      return { profile: p.data, student: s.data };
    },
    enabled: !!user,
  });

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="font-display text-2xl font-bold">Profile</h2>
      <Card className="p-6 space-y-3">
        <Row label="Full name" value={data?.profile?.full_name} />
        <Row label="Email" value={data?.profile?.email} />
        <Row label="Phone" value={data?.profile?.phone} />
        {data?.student && <>
          <Row label="Admission No" value={data.student.admission_no} />
          <Row label="Gender" value={data.student.gender} />
          <Row label="Class" value={(data.student as any).classes?.name} />
          <Row label="Guardian" value={data.student.guardian_name} />
          <Row label="Guardian phone" value={data.student.guardian_phone} />
        </>}
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}
