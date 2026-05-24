import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/teacher/assignments")({ component: AssignmentsPage });

function AssignmentsPage() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["my-assign-full", user?.id],
    queryFn: async () => (await supabase.from("teacher_assignments").select("*, subjects(name, code), classes(name, level)").eq("teacher_id", user!.id)).data ?? [],
    enabled: !!user,
  });
  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold">My subjects</h2>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Code</TableHead><TableHead>Class</TableHead><TableHead>Level</TableHead></TableRow></TableHeader>
          <TableBody>
            {data?.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{(a as any).subjects?.name}</TableCell>
                <TableCell className="font-mono text-xs">{(a as any).subjects?.code}</TableCell>
                <TableCell>{(a as any).classes?.name}</TableCell>
                <TableCell className="text-muted-foreground">{(a as any).classes?.level}</TableCell>
              </TableRow>
            ))}
            {!data?.length && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No assignments yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
