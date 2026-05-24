import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/student/")({ component: StudentDash });

function StudentDash() {
  const { user } = useAuth();
  const { data: student } = useQuery({
    queryKey: ["my-student", user?.id],
    queryFn: async () => (await supabase.from("students").select("*, classes(name)").eq("user_id", user!.id).maybeSingle()).data,
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <Card className="p-8">
        <div className="flex items-start gap-4">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary"><GraduationCap className="size-8" /></div>
          <div className="flex-1">
            <h2 className="font-display text-2xl font-bold">{student?.full_name ?? user?.email}</h2>
            <p className="text-sm text-muted-foreground">
              {student ? <>Admission No: <span className="font-mono">{student.admission_no}</span> · Class: {(student as any).classes?.name ?? "Unassigned"}</> : "Your student record is not yet linked. Contact admin."}
            </p>
          </div>
        </div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-6">
          <FileText className="mb-2 size-6 text-primary" />
          <h3 className="font-display font-semibold">Check result</h3>
          <p className="mb-4 text-sm text-muted-foreground">View, print, or download your term report.</p>
          <Button asChild><Link to="/student/result">Open report card</Link></Button>
        </Card>
      </div>
    </div>
  );
}
