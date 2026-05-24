import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { calcGrade, gradeRemark, ordinal } from "@/lib/result-utils";
import { GraduationCap } from "lucide-react";

export function ReportCard({ studentId, termId }: { studentId: string; termId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["report-card", studentId, termId],
    queryFn: async () => {
      const [{ data: student }, { data: term }, { data: settings }, { data: subjects }] = await Promise.all([
        supabase.from("students").select("*, classes(*)").eq("id", studentId).single(),
        supabase.from("terms").select("*, sessions(name)").eq("id", termId).single(),
        supabase.from("school_settings").select("*").eq("id", 1).single(),
        supabase.from("subjects").select("*"),
      ]);
      if (!student || !term) return null;
      const sessionId = term.session_id;
      // All results for class+session+term (to compute positions, highest, lowest, average)
      const { data: classResults } = await supabase.from("results").select("*")
        .eq("class_id", student.class_id).eq("session_id", sessionId).eq("term_id", termId);
      const { data: attendance } = await supabase.from("attendance").select("*")
        .eq("student_id", studentId).eq("session_id", sessionId).eq("term_id", termId).maybeSingle();

      const myResults = classResults?.filter(r => r.student_id === studentId) ?? [];
      const usedSubjectIds = [...new Set(myResults.map(r => r.subject_id))];
      const rows = usedSubjectIds.map(sid => {
        const r = myResults.find(x => x.subject_id === sid)!;
        const subjectName = subjects?.find(s => s.id === sid)?.name ?? "";
        const sameSubject = classResults!.filter(x => x.subject_id === sid);
        const totals = sameSubject.map(x => Number(x.total));
        const sorted = [...sameSubject].sort((a, b) => Number(b.total) - Number(a.total));
        const position = sorted.findIndex(x => x.student_id === studentId) + 1;
        return {
          subject: subjectName,
          ca1: Number(r.ca1), ca2: Number(r.ca2), exam: Number(r.exam), total: Number(r.total),
          grade: r.grade ?? calcGrade(Number(r.total)),
          highest: Math.max(...totals), lowest: Math.min(...totals),
          average: totals.reduce((a, b) => a + b, 0) / totals.length,
          position,
        };
      });

      // Overall class position
      const studentTotals: Record<string, number> = {};
      classResults?.forEach(r => { studentTotals[r.student_id] = (studentTotals[r.student_id] ?? 0) + Number(r.total); });
      const ranked = Object.entries(studentTotals).sort((a, b) => b[1] - a[1]);
      const overallPos = ranked.findIndex(([id]) => id === studentId) + 1;
      const overallTotal = studentTotals[studentId] ?? 0;
      const overallAvg = rows.length ? overallTotal / rows.length : 0;

      return { student, term, settings, rows, attendance, overallPos, overallTotal, overallAvg, classSize: ranked.length };
    },
  });

  if (isLoading) return <Card className="p-12 text-center text-muted-foreground">Loading report...</Card>;
  if (!data) return <Card className="p-12 text-center text-muted-foreground">No report data.</Card>;
  if (!data.rows.length) return <Card className="p-12 text-center text-muted-foreground">No results recorded for this term yet.</Card>;

  const { student, term, settings, rows, attendance, overallPos, overallTotal, overallAvg, classSize } = data;

  return (
    <Card className="print-page mx-auto max-w-4xl bg-white p-8 text-foreground shadow-lg">
      <header className="flex items-center gap-4 border-b-4 border-primary pb-4">
        {settings?.logo_url
          ? <img src={settings.logo_url} alt="logo" className="size-20 object-contain" />
          : <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary"><GraduationCap className="size-10" /></div>}
        <div className="flex-1 text-center">
          <h1 className="font-display text-3xl font-bold uppercase text-primary">{settings?.school_name ?? "HisGrace Academy"}</h1>
          {settings?.motto && <p className="text-sm italic text-muted-foreground">{settings.motto}</p>}
          {settings?.address && <p className="text-xs text-muted-foreground">{settings.address}</p>}
          <p className="mt-1 text-sm font-semibold">STUDENT TERMINAL REPORT</p>
        </div>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <Row label="Name" value={student.full_name} />
        <Row label="Admission No" value={student.admission_no} />
        <Row label="Class" value={(student as any).classes?.name} />
        <Row label="Gender" value={student.gender ?? ""} />
        <Row label="Session" value={(term as any).sessions?.name} />
        <Row label="Term" value={term.name} />
      </section>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="bg-primary text-primary-foreground">
            <th className="border p-2 text-left">Subject</th>
            <th className="border p-2">CA1 (20)</th>
            <th className="border p-2">CA2 (20)</th>
            <th className="border p-2">Exam (60)</th>
            <th className="border p-2">Total</th>
            <th className="border p-2">Grade</th>
            <th className="border p-2">Position</th>
            <th className="border p-2">High</th>
            <th className="border p-2">Low</th>
            <th className="border p-2">Avg</th>
            <th className="border p-2">Remark</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.subject}>
              <td className="border p-2 font-medium">{r.subject}</td>
              <td className="border p-2 text-center">{r.ca1}</td>
              <td className="border p-2 text-center">{r.ca2}</td>
              <td className="border p-2 text-center">{r.exam}</td>
              <td className="border p-2 text-center font-semibold">{r.total}</td>
              <td className="border p-2 text-center font-bold">{r.grade}</td>
              <td className="border p-2 text-center">{ordinal(r.position)}</td>
              <td className="border p-2 text-center">{r.highest}</td>
              <td className="border p-2 text-center">{r.lowest}</td>
              <td className="border p-2 text-center">{r.average.toFixed(1)}</td>
              <td className="border p-2 text-center">{gradeRemark(r.grade)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-6 grid grid-cols-2 gap-6">
        <div className="rounded-md border p-4 text-sm">
          <h3 className="mb-2 font-display font-bold uppercase text-primary">Summary</h3>
          <Row label="Total Score" value={String(overallTotal)} />
          <Row label="Average" value={overallAvg.toFixed(2) + "%"} />
          <Row label="Position in class" value={`${ordinal(overallPos)} of ${classSize}`} />
          {attendance && <>
            <Row label="Days present" value={String(attendance.present)} />
            <Row label="Days absent" value={String(attendance.absent)} />
            <Row label="Total school days" value={String(attendance.total_days)} />
          </>}
        </div>
        <div className="rounded-md border p-4 text-sm">
          <h3 className="mb-2 font-display font-bold uppercase text-primary">Grading scale</h3>
          <ul className="space-y-1">
            <li>70 – 100 : A (Excellent)</li>
            <li>60 – 69 : B (Very Good)</li>
            <li>50 – 59 : C (Good)</li>
            <li>45 – 49 : D (Pass)</li>
            <li>0 – 44 : F (Fail)</li>
          </ul>
        </div>
      </section>

      <footer className="mt-10 flex items-end justify-between border-t pt-6 text-sm">
        <div>
          {settings?.principal_signature_url && <img src={settings.principal_signature_url} alt="signature" className="h-12 object-contain" />}
          <div className="mt-1 border-t pt-1 font-medium">{settings?.principal_name ?? "Principal"}</div>
          <div className="text-xs text-muted-foreground">Principal's signature</div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>Generated {new Date().toLocaleDateString()}</p>
          <p>HisGrace RPS</p>
        </div>
      </footer>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b py-1 last:border-0">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
