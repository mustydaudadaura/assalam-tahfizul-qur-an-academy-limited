import { Fragment, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRef as _unused } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { calcGrade, gradeRemark, ordinal } from "@/lib/result-utils";
import { GraduationCap, Printer, Download } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const TERM_ORDER: Record<string, number> = { "first term": 1, "second term": 2, "third term": 3 };
const termRank = (name: string) => TERM_ORDER[name.trim().toLowerCase()] ?? 99;

const AFFECTIVE_TRAITS = [
  "Attentiveness", "Attitude to school work", "Cooperation", "Emotional stability",
  "Health habits", "Leadership", "Neatness", "Perseverance", "Politeness",
  "Punctuality", "Honesty", "Speaking and Writing",
];
const PSYCHOMOTOR_SKILLS = [
  "Drawing and Painting", "Handwriting", "Games and Sports",
  "Musical Skills", "Handling Tools", "Verbal Fluency", "Creativity",
];

type ReportMeta = {
  affective?: Record<string, number>;
  psychomotor?: Record<string, number>;
  promotion_status?: string | null;
  teacher_name?: string | null;
  teacher_signature_url?: string | null;
  head_name?: string | null;
  head_signature_url?: string | null;
  serial_no?: string | null;
  class_teacher_remark?: string | null;
  principal_remark?: string | null;
  next_term_begins?: string | null;
};

export function ReportCard({ studentId, termId }: { studentId: string; termId: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["report-card-v2", studentId, termId],
    queryFn: async () => {
      const [
        { data: student },
        { data: term },
        { data: settings },
        { data: subjects },
        { data: meta },
      ] = await Promise.all([
        supabase.from("students").select("*, classes(*)").eq("id", studentId).single(),
        supabase.from("terms").select("*, sessions(*)").eq("id", termId).single(),
        supabase.from("school_settings").select("*").eq("id", 1).single(),
        supabase.from("subjects").select("*"),
        supabase.from("student_term_reports").select("*").eq("student_id", studentId).eq("term_id", termId).maybeSingle(),
      ]);
      if (!student || !term || !student.class_id) return null;
      const sessionId = term.session_id;

      // All terms in this session (for B/F + cumulative)
      const { data: sessionTerms } = await supabase.from("terms").select("*").eq("session_id", sessionId);
      const currentRank = termRank(term.name);
      const priorTermIds = (sessionTerms ?? []).filter(t => termRank(t.name) < currentRank).map(t => t.id);
      const priorTermsByName = (sessionTerms ?? []).filter(t => termRank(t.name) < currentRank)
        .sort((a, b) => termRank(a.name) - termRank(b.name));

      // Current term: all results for this class so we can compute positions/averages
      const { data: classResults } = await supabase.from("results").select("*")
        .eq("class_id", student.class_id).eq("session_id", sessionId).eq("term_id", termId);

      // Prior term results for this student only (for B/F)
      const { data: priorResults } = priorTermIds.length
        ? await supabase.from("results").select("*").eq("student_id", studentId).eq("session_id", sessionId).in("term_id", priorTermIds)
        : { data: [] };

      const { data: attendance } = await supabase.from("attendance").select("*")
        .eq("student_id", studentId).eq("session_id", sessionId).eq("term_id", termId).maybeSingle();

      const myResults = classResults?.filter(r => r.student_id === studentId) ?? [];
      const usedSubjectIds = [...new Set(myResults.map(r => r.subject_id))];

      const rows = usedSubjectIds.map(sid => {
        const subj = subjects?.find(s => s.id === sid);
        const subjectName = subj?.name ?? "";
        const category = subj?.category ?? "Core Subjects";
        const r = myResults.find(x => x.subject_id === sid)!;
        const total = Number(r.total ?? (Number(r.ca1) + Number(r.ca2) + Number(r.exam)));
        const sameSubject = classResults!.filter(x => x.subject_id === sid);
        const totals = sameSubject.map(x => Number(x.total ?? 0));
        const sorted = [...sameSubject].sort((a, b) => Number(b.total ?? 0) - Number(a.total ?? 0));
        const position = sorted.findIndex(x => x.student_id === studentId) + 1;

        // B/F per prior term in same session
        const bfByTerm: Record<string, number | null> = {};
        priorTermsByName.forEach(pt => {
          const pr = priorResults?.find(x => x.subject_id === sid && x.term_id === pt.id);
          bfByTerm[pt.id] = pr ? Number(pr.total ?? 0) : null;
        });
        const bfFirst = priorTermsByName[0] ? bfByTerm[priorTermsByName[0].id] : null;
        const bfSecond = priorTermsByName[1] ? bfByTerm[priorTermsByName[1].id] : null;

        const priorSum = (bfFirst ?? 0) + (bfSecond ?? 0);
        const termsCounted = 1 + (bfFirst != null ? 1 : 0) + (bfSecond != null ? 1 : 0);
        const cumulative = total + priorSum;
        const percentage = total; // total is already out of 100

        return {
          subject_id: sid,
          subject: subjectName,
          category,
          bfFirst, bfSecond,
          ca1: Number(r.ca1), ca2: Number(r.ca2), exam: Number(r.exam),
          total, percentage,
          cumulative, termsCounted,
          grade: r.grade ?? calcGrade(total),
          highest: totals.length ? Math.max(...totals) : 0,
          lowest: totals.length ? Math.min(...totals) : 0,
          average: totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0,
          position,
        };
      });

      // Overall class ranking by total of current term
      const studentTotals: Record<string, number> = {};
      classResults?.forEach(r => { studentTotals[r.student_id] = (studentTotals[r.student_id] ?? 0) + Number(r.total ?? 0); });
      const ranked = Object.entries(studentTotals).sort((a, b) => b[1] - a[1]);
      const overallPos = ranked.findIndex(([id]) => id === studentId) + 1;
      const overallTotal = studentTotals[studentId] ?? 0;
      const overallObtainable = rows.length * 100;
      const overallAvg = rows.length ? overallTotal / rows.length : 0;

      // Group by category preserving discovery order
      const grouped: { category: string; items: typeof rows }[] = [];
      rows.forEach(r => {
        const g = grouped.find(x => x.category === r.category);
        if (g) g.items.push(r);
        else grouped.push({ category: r.category, items: [r] });
      });

      const m = (meta ?? {}) as ReportMeta;

      return {
        student, term, settings, attendance, rows, grouped,
        priorTermsByName,
        overallPos, overallTotal, overallObtainable, overallAvg,
        classSize: ranked.length, meta: m,
      };
    },
  });

  const downloadPdf = async () => {
    if (!ref.current) return;
    const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const img = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;
    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(img, "JPEG", 0, position, pageW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(img, "JPEG", 0, position, pageW, imgH);
      heightLeft -= pageH;
    }
    pdf.save(`report-${data?.student.admission_no ?? "student"}.pdf`);
  };

  if (isLoading) return <Card className="p-12 text-center text-muted-foreground">Loading report...</Card>;
  if (!data) return <Card className="p-12 text-center text-muted-foreground">No report data.</Card>;
  if (!data.rows.length) return <Card className="p-12 text-center text-muted-foreground">No results recorded for this term yet.</Card>;

  const { student, term, settings, attendance, grouped, priorTermsByName,
    overallPos, overallTotal, overallObtainable, overallAvg, classSize, meta } = data;
  const overallGrade = calcGrade(overallAvg);
  const sessionName = (term as { sessions?: { name?: string } }).sessions?.name ?? "";
  const className = (student as { classes?: { name?: string; section?: string | null } }).classes?.name ?? "";
  const sectionLabel = settings?.section_label
    || (student as { classes?: { section?: string | null } }).classes?.section
    || "";
  const present = attendance?.present ?? 0;
  const absent = attendance?.absent ?? 0;
  const opened = attendance?.total_days ?? (present + absent);

  const affective = (meta?.affective ?? {}) as Record<string, number>;
  const psychomotor = (meta?.psychomotor ?? {}) as Record<string, number>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 size-4" />Print</Button>
        <Button onClick={downloadPdf}><Download className="mr-2 size-4" />Download PDF</Button>
      </div>

      <div ref={ref} className="print-page mx-auto max-w-[210mm] bg-white p-5 font-sans text-[10px] leading-tight text-black shadow-lg print:shadow-none">
        {/* Header */}
        <div className="border-[3px] border-emerald-600 p-2">
          <div className="flex items-center gap-3">
            <div className="flex size-20 shrink-0 items-center justify-center rounded border border-emerald-600 bg-emerald-50">
              {settings?.logo_url
                ? <img src={settings.logo_url} alt="logo" className="size-full object-contain" crossOrigin="anonymous" />
                : <GraduationCap className="size-12 text-emerald-700" />}
            </div>
            <div className="flex-1 text-center">
              <h1 className="text-2xl font-extrabold uppercase tracking-wide text-emerald-800">{settings?.school_name ?? "School Name"}</h1>
              {sectionLabel && <div className="text-sm font-semibold">({sectionLabel.toUpperCase()})</div>}
              {settings?.address && <div className="text-[11px]">{settings.address}</div>}
              {settings?.motto && <div className="text-[11px]">Motto: {settings.motto}</div>}
              <div className="text-[11px]">
                {[settings?.phone, settings?.email, settings?.website].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div className="flex size-20 shrink-0 items-center justify-center rounded border border-emerald-600 bg-emerald-50">
              {settings?.secondary_logo_url
                ? <img src={settings.secondary_logo_url} alt="emblem" className="size-full object-contain" crossOrigin="anonymous" />
                : <span className="text-[10px] text-emerald-700">Emblem</span>}
            </div>
          </div>
        </div>

        <div className="mt-2 border-2 border-emerald-600 bg-emerald-50/40 py-1 text-center text-base font-bold uppercase text-emerald-900">
          {sessionName} {term.name} Report Sheet
        </div>

        {/* Top info grid */}
        <div className="mt-2 grid grid-cols-12 gap-2">
          {/* Personal data */}
          <div className="col-span-5 border-2 border-emerald-600">
            <div className="bg-emerald-100 px-2 py-1 text-center text-[11px] font-bold uppercase text-emerald-900">Student's Personal Data</div>
            <table className="w-full">
              <tbody>
                <InfoRow label="Name" value={student.full_name} />
                <InfoRow label="Date of Birth" value={fmt(student.date_of_birth)} />
                <InfoRow label="Sex" value={(student.gender ?? "—").toUpperCase()} />
                <InfoRow label="Class" value={className} />
                <InfoRow label="House" value={(student as { house?: string | null }).house ?? "—"} />
                <InfoRow label="Admission No" value={student.admission_no} />
              </tbody>
            </table>
          </div>

          {/* Passport */}
          <div className="col-span-2 flex flex-col items-center justify-center border-2 border-emerald-600 p-1">
            <div className="h-28 w-full overflow-hidden border border-emerald-600 bg-muted">
              {student.passport_url
                ? <img src={student.passport_url} alt="passport" className="size-full object-cover" crossOrigin="anonymous" />
                : <div className="flex size-full items-center justify-center text-[9px] text-muted-foreground">Passport</div>}
            </div>
          </div>

          {/* Attendance + Term dates */}
          <div className="col-span-3 border-2 border-emerald-600">
            <div className="bg-emerald-100 px-2 py-1 text-center text-[11px] font-bold uppercase text-emerald-900">Attendance</div>
            <table className="w-full">
              <thead>
                <tr className="text-[9px]">
                  <th className="border-b border-emerald-600 p-1">School Opened</th>
                  <th className="border-b border-l border-emerald-600 p-1">Present</th>
                  <th className="border-b border-l border-emerald-600 p-1">Absent</th>
                </tr>
              </thead>
              <tbody>
                <tr className="text-center text-[12px] font-bold">
                  <td className="p-1">{opened}</td>
                  <td className="border-l border-emerald-600 p-1">{present}</td>
                  <td className="border-l border-emerald-600 p-1">{absent}</td>
                </tr>
              </tbody>
            </table>
            <div className="bg-emerald-100 px-2 py-1 text-center text-[10px] font-bold uppercase text-emerald-900">Terminal Duration</div>
            <table className="w-full">
              <thead>
                <tr className="text-[9px]">
                  <th className="border-b border-emerald-600 p-1">Term Begins</th>
                  <th className="border-b border-l border-emerald-600 p-1">Term Ends</th>
                  <th className="border-b border-l border-emerald-600 p-1">Next Term Begins</th>
                </tr>
              </thead>
              <tbody>
                <tr className="text-center">
                  <td className="p-1">{fmt((term as { term_begins?: string | null }).term_begins)}</td>
                  <td className="border-l border-emerald-600 p-1">{fmt((term as { term_ends?: string | null }).term_ends)}</td>
                  <td className="border-l border-emerald-600 p-1">{fmt(meta?.next_term_begins)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Summary box */}
          <div className="col-span-2 border-2 border-emerald-600">
            <SummaryCell label="Total Score Obtainable" value={String(overallObtainable)} />
            <SummaryCell label="Total Score Obtained" value={String(Math.round(overallTotal))} />
            <SummaryCell label="Average %" value={overallAvg.toFixed(1)} />
            <SummaryCell label="Overall Grade" value={overallGrade} />
            <div className="grid grid-cols-2">
              <div className="border-t border-emerald-600 p-1 text-center">
                <div className="text-[8px] uppercase">No. in Class</div>
                <div className="text-[12px] font-bold">{classSize}</div>
              </div>
              <div className="border-l border-t border-emerald-600 p-1 text-center">
                <div className="text-[8px] uppercase">Position</div>
                <div className="text-[12px] font-bold">{ordinal(overallPos)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Academic performance */}
        <div className="mt-2 border-2 border-emerald-600">
          <div className="bg-emerald-100 py-1 text-center text-[12px] font-bold uppercase text-emerald-900">Academic Performance</div>
          <table className="w-full border-collapse text-[9px]">
            <thead className="bg-emerald-50">
              <tr>
                <th className="border border-emerald-600 px-1 py-1 text-left" rowSpan={2}>SUBJECT</th>
                <th className="border border-emerald-600 px-1" colSpan={2}>B/F</th>
                <th className="border border-emerald-600 px-1" rowSpan={2}>CA</th>
                <th className="border border-emerald-600 px-1" rowSpan={2}>CA</th>
                <th className="border border-emerald-600 px-1" rowSpan={2}>EXAM</th>
                <th className="border border-emerald-600 px-1" rowSpan={2}>TOTAL<br/>SCORE</th>
                <th className="border border-emerald-600 px-1" rowSpan={2}>%</th>
                <th className="border border-emerald-600 px-1" rowSpan={2}>CUM.<br/>TOTAL</th>
                <th className="border border-emerald-600 px-1" rowSpan={2}>POSITION</th>
                <th className="border border-emerald-600 px-1" rowSpan={2}>CLASS<br/>AVG</th>
                <th className="border border-emerald-600 px-1" rowSpan={2}>REMARKS</th>
                <th className="border border-emerald-600 px-1" rowSpan={2}>GRADE</th>
                <th className="border border-emerald-600 px-1" rowSpan={2}>SIGN</th>
              </tr>
              <tr>
                <th className="border border-emerald-600 px-1">{priorTermsByName[0]?.name ?? "1ST"}<br/>100</th>
                <th className="border border-emerald-600 px-1">{priorTermsByName[1]?.name ?? "2ND"}<br/>100</th>
              </tr>
              <tr className="bg-white text-[8px] text-muted-foreground">
                <th className="border border-emerald-600 px-1"></th>
                <th className="border border-emerald-600 px-1">100</th>
                <th className="border border-emerald-600 px-1">100</th>
                <th className="border border-emerald-600 px-1">20</th>
                <th className="border border-emerald-600 px-1">20</th>
                <th className="border border-emerald-600 px-1">60</th>
                <th className="border border-emerald-600 px-1">100</th>
                <th className="border border-emerald-600 px-1"></th>
                <th className="border border-emerald-600 px-1"></th>
                <th className="border border-emerald-600 px-1"></th>
                <th className="border border-emerald-600 px-1"></th>
                <th className="border border-emerald-600 px-1"></th>
                <th className="border border-emerald-600 px-1"></th>
                <th className="border border-emerald-600 px-1"></th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(group => (
                <>
                  <tr key={`g-${group.category}`} className="bg-emerald-100/70">
                    <td colSpan={14} className="border border-emerald-600 px-2 py-0.5 text-center text-[10px] font-bold uppercase text-emerald-900">
                      {group.category}
                    </td>
                  </tr>
                  {group.items.map(r => {
                    const isFail = r.grade === "F";
                    return (
                      <tr key={r.subject_id} className={isFail ? "bg-rose-50/60" : ""}>
                        <td className="border border-emerald-600 px-1 py-0.5 font-semibold uppercase">{r.subject}</td>
                        <td className="border border-emerald-600 px-1 text-center">{r.bfFirst ?? ""}</td>
                        <td className="border border-emerald-600 px-1 text-center">{r.bfSecond ?? ""}</td>
                        <td className="border border-emerald-600 px-1 text-center">{r.ca1}</td>
                        <td className="border border-emerald-600 px-1 text-center">{r.ca2}</td>
                        <td className="border border-emerald-600 px-1 text-center">{r.exam}</td>
                        <td className="border border-emerald-600 px-1 text-center font-bold">{r.total}</td>
                        <td className="border border-emerald-600 px-1 text-center">{r.percentage.toFixed(1)}</td>
                        <td className="border border-emerald-600 px-1 text-center">{Math.round(r.cumulative)}</td>
                        <td className="border border-emerald-600 px-1 text-center">{ordinal(r.position)}</td>
                        <td className="border border-emerald-600 px-1 text-center">{r.average.toFixed(1)}</td>
                        <td className="border border-emerald-600 px-1 text-center">{gradeRemark(r.grade)}</td>
                        <td className="border border-emerald-600 px-1 text-center font-bold">{r.grade}</td>
                        <td className="border border-emerald-600 px-1"></td>
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Keys to rating */}
        <div className="mt-2 border-2 border-emerald-600">
          <div className="bg-emerald-100 py-0.5 text-center text-[10px] font-bold uppercase text-emerald-900">Keys to Rating</div>
          <div className="grid grid-cols-5 text-center text-[10px]">
            <div className="border-r border-emerald-600 p-1"><b>A</b> · 70-100 · Excellent</div>
            <div className="border-r border-emerald-600 p-1"><b>B</b> · 60-69 · Very Good</div>
            <div className="border-r border-emerald-600 p-1"><b>C</b> · 50-59 · Good</div>
            <div className="border-r border-emerald-600 p-1"><b>D</b> · 45-49 · Fair</div>
            <div className="p-1"><b>F</b> · 0-44 · Fail</div>
          </div>
        </div>

        {/* Affective + Psychomotor */}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <RatingTable title="Affective Traits" items={AFFECTIVE_TRAITS} ratings={affective} />
          <div className="space-y-2">
            <RatingTable title="Psychomotor Skills" items={PSYCHOMOTOR_SKILLS} ratings={psychomotor} />
            <div className="border-2 border-emerald-600">
              <div className="bg-emerald-100 py-0.5 text-center text-[10px] font-bold uppercase text-emerald-900">Keys to Grade</div>
              <div className="grid grid-cols-5 text-center text-[9px]">
                <div className="border-r border-emerald-600 p-1">5 · Excellent</div>
                <div className="border-r border-emerald-600 p-1">4 · Very Good</div>
                <div className="border-r border-emerald-600 p-1">3 · Good</div>
                <div className="border-r border-emerald-600 p-1">2 · Fair</div>
                <div className="p-1">1 · Poor</div>
              </div>
            </div>
          </div>
        </div>

        {/* Comments */}
        <div className="mt-2 space-y-1 border-2 border-emerald-600 p-2 text-[10px]">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <span className="font-bold uppercase">Class Teacher's Comment: </span>
              <span className="italic">{meta?.class_teacher_remark || "—"}</span>
            </div>
            <div className="flex items-end gap-2">
              <div className="text-center">
                {meta?.teacher_signature_url && <img src={meta.teacher_signature_url} alt="sign" className="h-8 object-contain" crossOrigin="anonymous" />}
                <div className="border-t border-black px-2 text-[9px]">{meta?.teacher_name || "Signature"}</div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3 border-t border-emerald-300 pt-1">
            <div className="flex-1 min-w-[200px]">
              <span className="font-bold uppercase">{headRoleFor(sectionLabel)} Comment: </span>
              <span className="italic">{meta?.principal_remark || "—"}</span>
            </div>
            <div className="flex items-end gap-2">
              <div className="text-center">
                {(meta?.head_signature_url || settings?.principal_signature_url) && (
                  <img src={meta?.head_signature_url || settings?.principal_signature_url || ""} alt="sign" className="h-8 object-contain" crossOrigin="anonymous" />
                )}
                <div className="border-t border-black px-2 text-[9px]">{meta?.head_name || settings?.principal_name || "Signature"}</div>
              </div>
            </div>
          </div>
          {meta?.promotion_status && (
            <div className="border-t border-emerald-300 pt-1 font-bold uppercase text-emerald-800">
              Promotion Status: {meta.promotion_status}
            </div>
          )}
        </div>

        {/* Authentication */}
        <div className="mt-2 flex items-center justify-between text-[9px] text-muted-foreground">
          <div>
            Serial No: <span className="font-mono">{meta?.serial_no || `RPT-${student.admission_no}-${term.id.slice(0, 6)}`}</span>
          </div>
          <div>Generated {new Date().toLocaleDateString()}</div>
          <div>Verify online · school portal</div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="border-t border-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-900">{label}</td>
      <td className="border-l border-t border-emerald-600 px-2 py-0.5 text-[10px]">{value}</td>
    </tr>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-5 border-t border-emerald-600 first:border-t-0">
      <div className="col-span-3 bg-emerald-50 p-1 text-[9px] font-semibold uppercase">{label}</div>
      <div className="col-span-2 border-l border-emerald-600 p-1 text-center text-[12px] font-bold">{value}</div>
    </div>
  );
}

function RatingTable({ title, items, ratings }: { title: string; items: string[]; ratings: Record<string, number> }) {
  return (
    <div className="border-2 border-emerald-600">
      <div className="bg-emerald-100 py-0.5 text-center text-[10px] font-bold uppercase text-emerald-900">{title}</div>
      <table className="w-full text-[9px]">
        <thead>
          <tr>
            <th className="border-y border-emerald-600 p-1 text-left">Trait</th>
            {[1, 2, 3, 4, 5].map(n => <th key={n} className="border border-emerald-600 p-1 w-5 text-center">{n}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.map(t => {
            const r = ratings[t];
            return (
              <tr key={t}>
                <td className="border border-emerald-600 px-1">{t}</td>
                {[1, 2, 3, 4, 5].map(n => (
                  <td key={n} className="border border-emerald-600 p-0 text-center">{r === n ? "✓" : ""}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function fmt(d?: string | null) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB");
}

function headRoleFor(section?: string) {
  const s = (section ?? "").toLowerCase();
  if (s.includes("nursery")) return "Head of Nursery's";
  if (s.includes("primary")) return "Headmaster's";
  return "Principal's";
}
