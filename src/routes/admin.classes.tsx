import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/classes")({ component: ClassesPage });

function ClassesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");

  const { data: classes } = useQuery({ queryKey: ["classes"], queryFn: async () => (await supabase.from("classes").select("*").order("name")).data ?? [] });

  const add = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("classes").insert({ name, level }); if (error) throw error; },
    onSuccess: () => { toast.success("Added"); qc.invalidateQueries({ queryKey: ["classes"] }); setName(""); setLevel(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("classes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["classes"] }),
  });

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold">Classes</h2>
      <Card className="p-6">
        <form onSubmit={e => { e.preventDefault(); add.mutate(); }} className="flex flex-wrap gap-3">
          <Input placeholder="Class name (e.g. JSS 1)" value={name} onChange={e => setName(e.target.value)} required className="flex-1 min-w-40" />
          <Input placeholder="Level (Junior/Senior)" value={level} onChange={e => setLevel(e.target.value)} className="flex-1 min-w-40" />
          <Button type="submit"><Plus className="mr-2 size-4" />Add</Button>
        </form>
      </Card>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Level</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {classes?.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.level}</TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => del.mutate(c.id)}><Trash2 className="size-4 text-destructive" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
