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

export const Route = createFileRoute("/admin/subjects")({ component: SubjectsPage });

const CATEGORIES = ["Core Subjects", "Vocational", "Elective", "Pre-Vocational"];

function SubjectsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("Core Subjects");

  const { data: subjects } = useQuery({ queryKey: ["subjects"], queryFn: async () => (await supabase.from("subjects").select("*").order("name")).data ?? [] });
  const add = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("subjects").insert({ name, code, category }); if (error) throw error; },
    onSuccess: () => { toast.success("Added"); qc.invalidateQueries({ queryKey: ["subjects"] }); setName(""); setCode(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("subjects").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subjects"] }),
  });

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold">Subjects</h2>
      <Card className="p-6">
        <form onSubmit={e => { e.preventDefault(); add.mutate(); }} className="flex flex-wrap gap-3">
          <Input placeholder="Subject name" value={name} onChange={e => setName(e.target.value)} required className="flex-1 min-w-40" />
          <Input placeholder="Code (e.g. MTH)" value={code} onChange={e => setCode(e.target.value)} className="w-32" />
          <select value={category} onChange={e => setCategory(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <Button type="submit"><Plus className="mr-2 size-4" />Add</Button>
        </form>
      </Card>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Category</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {subjects?.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{s.code}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{(s as { category?: string }).category ?? "—"}</TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => del.mutate(s.id)}><Trash2 className="size-4 text-destructive" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
