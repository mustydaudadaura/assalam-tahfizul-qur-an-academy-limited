import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReportCard } from "@/components/ReportCard";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/student/result")({ component: StudentResultPage });

function StudentResultPage() {
  const { user } = useAuth();
  const [termId, setTermId] = useState("");

  const { data: student } = useQuery({
    queryKey: ["my-student-full", user?.id],
    queryFn: async () => (await supabase.from("students").select("*, classes(*)").eq("user_id", user!.id).maybeSingle()).data,
    enabled: !!user,
  });
  const { data: sessions } = useQuery({ queryKey: ["sessions"], queryFn: async () => (await supabase.from("sessions").select("*, terms(*)").order("created_at", { ascending: false })).data ?? [] });

  const allTerms = useMemo(() => sessions?.flatMap(s => (s as any).terms.map((t: any) => ({ ...t, session_name: s.name }))) ?? [], [sessions]);

  if (!student) return <Card className="p-8 text-center text-muted-foreground">Your student record isn't linked. Contact admin.</Card>;

  return (
    <div className="space-y-4">
      <Card className="p-4 no-print">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-60">
            <Label>Term</Label>
            <Select value={termId} onValueChange={setTermId}>
              <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
              <SelectContent>{allTerms.map(t => <SelectItem key={t.id} value={t.id}>{t.session_name} — {t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {termId && <Button onClick={() => window.print()}><Printer className="mr-2 size-4" />Print / Save PDF</Button>}
        </div>
      </Card>
      {termId && <ReportCard studentId={student.id} termId={termId} />}
    </div>
  );
}
