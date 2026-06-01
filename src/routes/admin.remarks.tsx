import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/remarks")({ component: RemarksPage });

const AFFECTIVE = [
  "Attentiveness", "Attitude to school work", "Cooperation", "Emotional stability",
  "Health habits", "Leadership", "Neatness", "Perseverance", "Politeness",
  "Punctuality", "Honesty", "Speaking and Writing",
];
const PSYCHOMOTOR = [
  "Drawing and Painting", "Handwriting", "Games and Sports",
  "Musical Skills", "Handling Tools", "Verbal Fluency", "Creativity",
];
const RATINGS = [5, 4, 3, 2, 1];
const PROMOTION = ["Promoted to next class", "Repeated", "Graduated"];

type Meta = {
  class_teacher_remark: string;
  principal_remark: string;
  next_term_begins: string;
  promotion_status: string;
  teacher_name: string;
  head_name: string;
  affective: Record<string, number>;
  psychomotor: Record<string, number>;
};

const blank = (): Meta => ({
  class_teacher_remark: "", principal_remark: "", next_term_begins: "",
  promotion_status: "", teacher_name: "", head_name: "",
  affective: {}, psychomotor: {},
});

function RemarksPage() {
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [data, setData] = useState<Record<string, Meta>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: classes } = useQuery({ queryKey: ["classes"], queryFn: async () => (await supabase.from("classes").select("*").order("name")).data ?? [] });
  const { data: sessions } = useQuery({ queryKey: ["sessions"], queryFn: async () => (await supabase.from("sessions").select("*, terms(*)").order("created_at", { ascending: false })).data ?? [] });
  const terms = sessions?.find(s => s.id === sessionId)?.terms ?? [];

  const { data: students } = useQuery({
    queryKey: ["remarks-students", classId, termId],
    queryFn: async () => {
      if (!classId || !termId) return [];
      const { data: studs } = await supabase.from("students").select("id, full_name, admission_no").eq("class_id", classId).order("full_name");
      return studs ?? [];
    },
    enabled: !!classId && !!termId,
  });

  const { data: existing } = useQuery({
    queryKey: ["remarks-existing", termId, students?.map(s => s.id).join(",")],
    queryFn: async () => {
      if (!termId || !students?.length) return [];
      const { data } = await supabase.from("student_term_reports").select("*").eq("term_id", termId).in("student_id", students.map(s => s.id));
      return data ?? [];
    },
    enabled: !!termId && !!students?.length,
  });

  useEffect(() => {
    if (!existing || !students) return;
    const map: Record<string, Meta> = {};
    students.forEach(s => {
      const e = existing.find(x => x.student_id === s.id) as any;
      map[s.id] = {
        ...blank(),
        class_teacher_remark: e?.class_teacher_remark ?? "",
        principal_remark: e?.principal_remark ?? "",
        next_term_begins: e?.next_term_begins ?? "",
        promotion_status: e?.promotion_status ?? "",
        teacher_name: e?.teacher_name ?? "",
        head_name: e?.head_name ?? "",
        affective: e?.affective ?? {},
        psychomotor: e?.psychomotor ?? {},
      };
    });
    setData(map);
  }, [existing, students]);

  const save = useMutation({
    mutationFn: async () => {
      const rows = Object.entries(data).map(([student_id, m]) => ({
        student_id, term_id: termId,
        class_teacher_remark: m.class_teacher_remark || null,
        principal_remark: m.principal_remark || null,
        next_term_begins: m.next_term_begins || null,
        promotion_status: m.promotion_status || null,
        teacher_name: m.teacher_name || null,
        head_name: m.head_name || null,
        affective: m.affective ?? {},
        psychomotor: m.psychomotor ?? {},
      }));
      const { error } = await supabase.from("student_term_reports").upsert(rows as any, { onConflict: "student_id,term_id" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["remarks-existing"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const upd = (id: string, patch: Partial<Meta>) => setData(d => ({ ...d, [id]: { ...d[id], ...patch } }));
  const updRating = (id: string, group: "affective" | "psychomotor", trait: string, value: number) =>
    setData(d => ({ ...d, [id]: { ...d[id], [group]: { ...d[id][group], [trait]: value } } }));

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold">Remarks, ratings & promotion</h2>
      <Card className="p-6">
        <div className="grid gap-3 md:grid-cols-3">
          <div><Label>Session</Label>
            <Select value={sessionId} onValueChange={v => { setSessionId(v); setTermId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{sessions?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Term</Label>
            <Select value={termId} onValueChange={setTermId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{terms.map((t: { id: string; name: string }) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{classes?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {classId && termId && (
        <Card>
          <div className="flex items-center justify-between p-4">
            <p className="text-sm text-muted-foreground">{students?.length ?? 0} students · 5 = Excellent, 1 = Poor</p>
            <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="mr-2 size-4" />Save all</Button>
          </div>
          <div className="divide-y">
            {students?.map(s => {
              const m = data[s.id] ?? blank();
              const isOpen = openId === s.id;
              return (
                <div key={s.id} className="p-4">
                  <button onClick={() => setOpenId(isOpen ? null : s.id)} className="flex w-full items-center justify-between gap-2 text-left">
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      <span className="font-medium">{s.full_name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{s.admission_no}</span>
                    </div>
                    {m.promotion_status && <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">{m.promotion_status}</span>}
                  </button>
                  {isOpen && (
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div><Label>Class teacher remark</Label><Textarea rows={2} value={m.class_teacher_remark} onChange={e => upd(s.id, { class_teacher_remark: e.target.value })} /></div>
                        <div><Label>Principal remark</Label><Textarea rows={2} value={m.principal_remark} onChange={e => upd(s.id, { principal_remark: e.target.value })} /></div>
                        <div><Label>Class teacher name</Label><Input value={m.teacher_name} onChange={e => upd(s.id, { teacher_name: e.target.value })} /></div>
                        <div><Label>Head of school name</Label><Input value={m.head_name} onChange={e => upd(s.id, { head_name: e.target.value })} /></div>
                        <div><Label>Next term begins</Label><Input type="date" value={m.next_term_begins} onChange={e => upd(s.id, { next_term_begins: e.target.value })} /></div>
                        <div><Label>Promotion status</Label>
                          <Select value={m.promotion_status} onValueChange={v => upd(s.id, { promotion_status: v })}>
                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>{PROMOTION.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <RatingGrid title="Affective traits" traits={AFFECTIVE} values={m.affective} onChange={(t, v) => updRating(s.id, "affective", t, v)} />
                      <RatingGrid title="Psychomotor skills" traits={PSYCHOMOTOR} values={m.psychomotor} onChange={(t, v) => updRating(s.id, "psychomotor", t, v)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function RatingGrid({ title, traits, values, onChange }: { title: string; traits: string[]; values: Record<string, number>; onChange: (trait: string, v: number) => void }) {
  return (
    <div className="rounded-md border">
      <div className="bg-muted/50 px-3 py-2 text-sm font-semibold">{title}</div>
      <div className="grid gap-2 p-3 sm:grid-cols-2">
        {traits.map(t => (
          <div key={t} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{t}</span>
            <div className="flex shrink-0 gap-1">
              {RATINGS.map(r => (
                <button key={r} type="button" onClick={() => onChange(t, r)}
                  className={`size-7 rounded border text-xs ${values[t] === r ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
