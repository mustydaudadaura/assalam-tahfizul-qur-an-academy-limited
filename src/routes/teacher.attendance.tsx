import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Check, X, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/teacher/attendance")({ component: AttendancePage });

type Status = "present" | "absent" | "late";

function AttendancePage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ class_id: "", session_id: "", term_id: "", date: today });
  const [marks, setMarks] = useState<Record<string, Status>>({});

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await supabase.from("classes").select("*").order("name")).data ?? [],
  });
  const { data: sessions } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => (await supabase.from("sessions").select("*, terms(*)").order("created_at", { ascending: false })).data ?? [],
  });
  const terms = sessions?.find((s) => s.id === f.session_id)?.terms ?? [];

  const ready = !!(f.class_id && f.session_id && f.term_id && f.date);

  const { data: students } = useQuery({
    queryKey: ["att-daily-roster", f.class_id, f.session_id, f.term_id, f.date],
    queryFn: async () => {
      const { data: studs } = await supabase
        .from("students")
        .select("id, full_name, admission_no")
        .eq("class_id", f.class_id)
        .order("full_name");
      if (!studs) return [];
      const { data: existing } = await supabase
        .from("attendance_daily")
        .select("student_id, status")
        .eq("session_id", f.session_id)
        .eq("term_id", f.term_id)
        .eq("date", f.date)
        .in("student_id", studs.map((s) => s.id));
      const map: Record<string, Status> = {};
      studs.forEach((s) => (map[s.id] = "present"));
      existing?.forEach((r) => (map[r.student_id] = r.status as Status));
      setMarks(map);
      return studs;
    },
    enabled: ready,
  });

  const setAll = (status: Status) => {
    if (!students) return;
    const next: Record<string, Status> = {};
    students.forEach((s) => (next[s.id] = status));
    setMarks(next);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!students?.length) throw new Error("No students to save");
      const rows = students.map((s) => ({
        student_id: s.id,
        class_id: f.class_id,
        session_id: f.session_id,
        term_id: f.term_id,
        date: f.date,
        status: marks[s.id] ?? "present",
        marked_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("attendance_daily")
        .upsert(rows, { onConflict: "student_id,session_id,term_id,date" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attendance saved");
      qc.invalidateQueries({ queryKey: ["att-daily-roster"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const summary = students?.reduce(
    (acc, s) => {
      const st = marks[s.id] ?? "present";
      acc[st]++;
      return acc;
    },
    { present: 0, absent: 0, late: 0 } as Record<Status, number>,
  );

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold">Attendance</h2>

      <Card className="p-6">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label>Session</Label>
            <Select value={f.session_id} onValueChange={(v) => setF({ ...f, session_id: v, term_id: "" })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{sessions?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Term</Label>
            <Select value={f.term_id} onValueChange={(v) => setF({ ...f, term_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{terms.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Class</Label>
            <Select value={f.class_id} onValueChange={(v) => setF({ ...f, class_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{classes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </div>
        </div>
      </Card>

      {ready && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div className="text-sm text-muted-foreground">
              {students?.length ?? 0} students · Present {summary?.present ?? 0} · Absent {summary?.absent ?? 0} · Late {summary?.late ?? 0}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setAll("present")}>Mark all present</Button>
              <Button size="sm" variant="outline" onClick={() => setAll("absent")}>Mark all absent</Button>
              <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
                <Save className="mr-2 size-4" />{save.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Adm No</TableHead>
                <TableHead>Student</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!students?.length && (
                <TableRow><TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">No students in this class.</TableCell></TableRow>
              )}
              {students?.map((s) => {
                const status = marks[s.id] ?? "present";
                const btn = (val: Status, icon: React.ReactNode, label: string) => (
                  <Button
                    type="button"
                    size="sm"
                    variant={status === val ? "default" : "outline"}
                    onClick={() => setMarks({ ...marks, [s.id]: val })}
                  >
                    {icon}<span className="ml-1 hidden sm:inline">{label}</span>
                  </Button>
                );
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.admission_no}</TableCell>
                    <TableCell className="font-medium">{s.full_name}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {btn("present", <Check className="size-4" />, "Present")}
                        {btn("late", <Clock className="size-4" />, "Late")}
                        {btn("absent", <X className="size-4" />, "Absent")}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
