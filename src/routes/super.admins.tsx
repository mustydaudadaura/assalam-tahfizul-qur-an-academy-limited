import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapSuperAdmin } from "@/lib/super-admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/super/admins")({ component: SuperAdmins });

function SuperAdmins() {
  const qc = useQueryClient();
  const promoteFn = useServerFn(bootstrapSuperAdmin);
  const [email, setEmail] = useState("");

  const { data: admins } = useQuery({
    queryKey: ["super-admins"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "super_admin");
      const ids = (roles ?? []).map(r => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id, full_name, email, phone").in("id", ids);
      return data ?? [];
    },
  });

  const promoteMut = useMutation({
    mutationFn: () => promoteFn({ data: { email } }),
    onSuccess: () => { toast.success("Super admin granted"); qc.invalidateQueries({ queryKey: ["super-admins"] }); setEmail(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Super admins</h2>
        <p className="text-sm text-muted-foreground">Grant platform-wide privileges to existing users.</p>
      </div>

      <Card className="p-5">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Label>User email (must already have an account)</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" />
          </div>
          <Button onClick={() => promoteMut.mutate()} disabled={!email || promoteMut.isPending}>
            <ShieldCheck className="mr-2 size-4" />Grant super admin
          </Button>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead></TableRow></TableHeader>
          <TableBody>
            {admins?.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.full_name}</TableCell>
                <TableCell className="text-sm">{a.email}</TableCell>
                <TableCell className="text-sm">{a.phone ?? "—"}</TableCell>
              </TableRow>
            ))}
            {!admins?.length && <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">No super admins yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
