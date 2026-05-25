import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { calcGrade, gradeRemark, ordinal } from "@/lib/result-utils";
import { GraduationCap, Printer, Download } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export function ReportCard({ studentId, termId }: { studentId: string; termId: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["report-card", studentId, termId],
    queryFn: async () => {
      const [{ data: student }, { data: term }, { data: settings }, { data: subjects }, { data: meta }] = await Promise.all([
        supabase.from("students").select("*, classes(*)").eq("id", studentId).single(),
        supabase.from("terms").select("*, sessions(name)").eq("id", termId).single(),
        supabase.from("school_settings").select("*").eq("id", 1).single(),
        supabase.from("subjects").select("*"),
        supabase.from("student_term_reports").select("*").eq("student_id", studentId).eq("term_id", termId).maybeSingle(),
      ]);
      if (!student || !term || !student.class_id) return null;
      const sessionId = term.session_id;
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
          ca1: Number(r.ca1), ca2: Number(r.ca2), ca3: Number((r as { ca3?: number }).ca3 ?? 0), exam: Number(r.exam), total: Number(r.total),
          grade: r.grade ?? calcGrade(Number(r.total)),
          highest: Math.max(...totals), lowest: Math.min(...totals),
          average: totals.reduce((a, b) => a + b, 0) / totals.length,
          position,
        };
      });

      const studentTotals: Record<string, number> = {};
      classResults?.forEach(r => { studentTotals[r.student_id] = (studentTotals[r.student_id] ?? 0) + Number(r.total); });
      const ranked = Object.entries(studentTotals).sort((a, b) => b[1] - a[1]);
      const overallPos = ranked.findIndex(([id]) => id === studentId) + 1;
      const overallTotal = studentTotals[studentId] ?? 0;
      const overallAvg = rows.length ? overallTotal / rows.length : 0;

      return { student, term, settings, rows, attendance, overallPos, overallTotal, overallAvg, classSize: ranked.length, meta };
    },
  });

  const downloadPdf = async () => {
    if (!ref.current) return;
    const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const img = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(img, "JPEG", 0, 0, w, h);
    pdf.save(`report-card-${data?.student.admission_no ?? "student"}.pdf`);
  };

  if (isLoading) return <Card className="p-12 text-center text-muted-foreground">Loading report...</Card>;
  if (!data) return <Card className="p-12 text-center text-muted-foreground">No report data.</Card>;
  if (!data.rows.length) return <Card className="p-12 text-center text-muted-foreground">No results recorded for this term yet.</Card>;

  const { student, term, settings, rows, attendance, overallPos, overallTotal, overallAvg, classSize, meta } = data;
  const overallGrade = calcGrade(overallAvg);

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 size-4" />Print</Button>
        <Button onClick={downloadPdf}><Download className="mr-2 size-4" />Download PDF</Button>
      </div>

      <Card ref={ref} className="print-page mx-auto max-w-4xl bg-white p-8 text-foreground shadow-lg">
        <header className="flex items-center gap-4 border-b-4 border-primary pb-4">
          {settings?.logo_url
            ? <img src={settings.logo_url} alt="logo" className="size-24 object-contain" crossOrigin="anonymous" />
            : <div className="flex size-24 items-center justify-center rounded-full bg-primary/10 text-primary"><GraduationCap className="size-12" /></div>}
          <div className="flex-1 text-center">
            <h1 className="font-display text-3xl font-bold uppercase text-primary">{settings?.school_name ?? "HisGrace Academy"}</h1>
            {settings?.motto && <p className="text-sm italic text-muted-foreground">{settings.motto}</p>}
            {settings?.address && <p className="text-xs text-muted-foreground">{settings.address}</p>}
            {(settings?.phone || settings?.email) && <p className="text-xs text-muted-foreground">{[settings.phone, settings.email].filter(Boolean).join(" · ")}</p>}
            <p className="mt-1 inline-block rounded bg-primary px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary-foreground">Student Terminal Report</p>
          </div>
          <div className="size-24 overflow-hidden rounded border-2 border-primary/30 bg-muted">
            {student.passport_url
              ? <img src={student.passport_url} alt="passport" className="size-full object-cover" crossOrigin="anonymous" />
              : <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">Passport</div>}
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <Row label="Name" value={student.full_name} />
          <Row label="Admission No" value={student.admission_no} />
          <Row label="Class" value={(student as { classes?: { name?: string } }).classes?.name ?? ""} />
          <Row label="Gender" value={student.gender ?? ""} />
          <Row label="Date of birth" value={student.date_of_birth ?? "—"} />
          <Row label="Parent phone" value={student.guardian_phone ?? "—"} />
          <Row label="Session" value={(term as { sessions?: { name?: string } }).sessions?.name ?? ""} />
          <Row label="Term" value={term.name} />
        </section>

        <table className="mt-6 w-full border-collapse text-xs">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              <th className="border p-1.5 text-left">Subject</th>
              <th className="border p-1.5">1st CA<br/>(10)</th>
              <th className="border p-1.5">2nd CA<br/>(10)</th>
              <th className="border p-1.5">3rd CA<br/>(20)</th>
              <th className="border p-1.5">Exam<br/>(60)</th>
              <th className="border p-1.5">Total<br/>(100)</th>
              <th className="border p-1.5">Grade</th>
              <th className="border p-1.5">Position</th>
              <th className="border p-1.5">High</th>
              <th className="border p-1.5">Low</th>
              <th className="border p-1.5">Avg</th>
              <th className="border p-1.5">Remark</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.subject}>
                <td className="border p-1.5 font-medium">{r.subject}</td>
                <td className="border p-1.5 text-center">{r.ca1}</td>
                <td className="border p-1.5 text-center">{r.ca2}</td>
                <td className="border p-1.5 text-center">{r.ca3}</td>
                <td className="border p-1.5 text-center">{r.exam}</td>
                <td className="border p-1.5 text-center font-semibold">{r.total}</td>
                <td className="border p-1.5 text-center font-bold">{r.grade}</td>
                <td className="border p-1.5 text-center">{ordinal(r.position)}</td>
                <td className="border p-1.5 text-center">{r.highest}</td>
                <td className="border p-1.5 text-center">{r.lowest}</td>
                <td className="border p-1.5 text-center">{r.average.toFixed(1)}</td>
                <td className="border p-1.5 text-center">{gradeRemark(r.grade)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-6 grid grid-cols-3 gap-4 text-sm">
          <div className="rounded-md border p-3">
            <h3 className="mb-2 font-display text-xs font-bold uppercase text-primary">Performance summary</h3>
            <Row label="Total score" value={String(overallTotal)} />
            <Row label="Average" value={overallAvg.toFixed(2) + "%"} />
            <Row label="Overall grade" value={overallGrade} />
            <Row label="Position in class" value={`${ordinal(overallPos)} of ${classSize}`} />
          </div>
          <div className="rounded-md border p-3">
            <h3 className="mb-2 font-display text-xs font-bold uppercase text-primary">Attendance</h3>
            {attendance ? <>
              <Row label="Days present" value={String(attendance.present)} />
              <Row label="Days absent" value={String(attendance.absent)} />
              <Row label="Total school days" value={String(attendance.total_days)} />
            </> : <p className="text-xs text-muted-foreground">Not recorded.</p>}
          </div>
          <div className="rounded-md border p-3">
            <h3 className="mb-2 font-display text-xs font-bold uppercase text-primary">Grading scale</h3>
            <ul className="space-y-0.5 text-xs">
              <li>70 – 100 : A (Excellent)</li>
              <li>60 – 69 : B (Very Good)</li>
              <li>50 – 59 : C (Good)</li>
              <li>45 – 49 : D (Pass)</li>
              <li>0 – 44 : F (Fail)</li>
            </ul>
          </div>
        </section>

        <section className="mt-4 space-y-2 text-sm">
          <div className="rounded-md border p-3">
            <span className="font-semibold text-primary">Class teacher's remark: </span>
            <span className="italic">{meta?.class_teacher_remark || "—"}</span>
          </div>
          <div className="rounded-md border p-3">
            <span className="font-semibold text-primary">Principal's remark: </span>
            <span className="italic">{meta?.principal_remark || "—"}</span>
          </div>
        </section>

        <footer className="mt-8 flex items-end justify-between border-t pt-4 text-sm">
          <div>
            <div className="mt-1 border-t pt-1 font-medium">Class Teacher</div>
          </div>
          <div className="text-center text-xs">
            <span className="font-semibold">Next term begins: </span>
            <span>{meta?.next_term_begins ? new Date(meta.next_term_begins).toLocaleDateString() : "—"}</span>
          </div>
          <div className="text-right">
            {settings?.principal_signature_url && <img src={settings.principal_signature_url} alt="signature" className="ml-auto h-12 object-contain" crossOrigin="anonymous" />}
            <div className="mt-1 border-t pt-1 font-medium">{settings?.principal_name ?? "Principal"}</div>
            <div className="text-xs text-muted-foreground">Principal's signature</div>
          </div>
        </footer>
      </Card>
    </div>
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
