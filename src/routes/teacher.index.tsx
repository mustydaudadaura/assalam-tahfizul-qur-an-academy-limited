import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { BookOpen, School } from "lucide-react";

export const Route = createFileRoute("/teacher/")({ component: TeacherDash });

function TeacherDash() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["my-assignments", user?.id],
    queryFn: async () => (await supabase.from("teacher_assignments").select("*, subjects(name), classes(name)").eq("teacher_id", user!.id)).data ?? [],
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold">Welcome, teacher</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <BookOpen className="mb-2 size-6 text-primary" />
          <div className="text-3xl font-bold font-display">{new Set(data?.map(a => a.subject_id)).size}</div>
          <div className="text-sm text-muted-foreground">Subjects assigned</div>
        </Card>
        <Card className="p-5">
          <School className="mb-2 size-6 text-accent" />
          <div className="text-3xl font-bold font-display">{new Set(data?.map(a => a.class_id)).size}</div>
          <div className="text-sm text-muted-foreground">Classes assigned</div>
        </Card>
      </div>
      <Card className="p-6">
        <h3 className="mb-3 font-display font-semibold">Your assignments</h3>
        {!data?.length && <p className="text-sm text-muted-foreground">No assignments yet. Ask admin to assign you subjects.</p>}
        <ul className="space-y-2">
          {data?.map(a => (
            <li key={a.id} className="flex justify-between rounded-md border p-3 text-sm">
              <span className="font-medium">{(a as any).subjects?.name}</span>
              <span className="text-muted-foreground">{(a as any).classes?.name}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
