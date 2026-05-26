import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Student = { id: string; admission_no: string; full_name: string };

type Props = {
  ready: boolean;
  students: Student[];
  filters: { class_id: string; subject_id: string; session_id: string; term_id: string };
  currentScores: Record<string, { ca1: number; ca2: number; ca3: number; exam: number }>;
  onImported: () => void;
};

type RowError = { admission_no: string; full_name?: string; reason: string };

const MAX_CA1 = 20;
const MAX_CA2 = 20;
const MAX_EXAM = 60;

export function ScoreImportExport({ ready, students, filters, currentScores, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [successCount, setSuccessCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const downloadTemplate = (ext: "xlsx" | "csv") => {
    const rows = students.map(s => {
      const sc = currentScores[s.id];
      return {
        AdmissionNo: s.admission_no,
        StudentName: s.full_name,
        "CA1 (max 20)": sc?.ca1 ?? "",
        "CA2 (max 20)": sc?.ca2 ?? "",
        "Exam (max 60)": sc?.exam ?? "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ AdmissionNo: "", StudentName: "", "CA1 (max 20)": "", "CA2 (max 20)": "", "Exam (max 60)": "" }]);
    ws["!cols"] = [{ wch: 14 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Scores");
    XLSX.writeFile(wb, `scores-template.${ext}`, { bookType: ext });
  };

  const pickKey = (row: Record<string, unknown>, candidates: string[]): unknown => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const map = new Map(Object.keys(row).map(k => [norm(k), k]));
    for (const c of candidates) {
      const hit = map.get(norm(c));
      if (hit !== undefined) return row[hit];
    }
    return undefined;
  };

  const parseNum = (v: unknown, max: number, label: string): { value?: number; error?: string } => {
    if (v === "" || v === null || v === undefined) return { value: 0 };
    const n = Number(v);
    if (Number.isNaN(n)) return { error: `${label} is not a number` };
    if (n < 0) return { error: `${label} cannot be negative` };
    if (n > max) return { error: `${label} exceeds max ${max}` };
    return { value: n };
  };

  const onFile = async (file: File) => {
    if (!ready) {
      toast.error("Select session, term, class, and subject first");
      return;
    }
    setBusy(true);
    setErrors([]);
    setSuccessCount(0);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      if (!rows.length) {
        toast.error("File is empty");
        setBusy(false);
        return;
      }

      const studentByAdm = new Map(students.map(s => [s.admission_no.trim().toLowerCase(), s]));
      const valid: { student_id: string; ca1: number; ca2: number; ca3: number; exam: number }[] = [];
      const errs: RowError[] = [];

      rows.forEach((row, i) => {
        const adm = String(pickKey(row, ["AdmissionNo", "Adm No", "Admission No", "admission_no"]) ?? "").trim();
        const name = String(pickKey(row, ["StudentName", "Student Name", "full_name", "Name"]) ?? "").trim();
        if (!adm) {
          errs.push({ admission_no: `Row ${i + 2}`, reason: "Missing admission number" });
          return;
        }
        const student = studentByAdm.get(adm.toLowerCase());
        if (!student) {
          errs.push({ admission_no: adm, full_name: name, reason: "Admission number not found in this class" });
          return;
        }
        const ca1 = parseNum(pickKey(row, ["CA1 (max 20)", "CA1", "1st CA", "ca1"]), MAX_CA1, "CA1");
        const ca2 = parseNum(pickKey(row, ["CA2 (max 20)", "CA2", "2nd CA", "ca2"]), MAX_CA2, "CA2");
        const exam = parseNum(pickKey(row, ["Exam (max 60)", "Exam", "exam"]), MAX_EXAM, "Exam");
        const fail = [ca1.error, ca2.error, exam.error].filter(Boolean).join("; ");
        if (fail) {
          errs.push({ admission_no: adm, full_name: student.full_name, reason: fail });
          return;
        }
        // preserve any existing ca3 from current data so we don't wipe it
        const ca3 = currentScores[student.id]?.ca3 ?? 0;
        valid.push({
          student_id: student.id,
          ca1: ca1.value!, ca2: ca2.value!, ca3, exam: exam.value!,
        });
      });

      if (valid.length) {
        const payload = valid.map(v => ({
          ...v,
          subject_id: filters.subject_id,
          class_id: filters.class_id,
          session_id: filters.session_id,
          term_id: filters.term_id,
        }));
        const { error } = await supabase
          .from("results")
          .upsert(payload, { onConflict: "student_id,subject_id,session_id,term_id" });
        if (error) {
          toast.error(`Save failed: ${error.message}`);
          setBusy(false);
          return;
        }
      }

      setSuccessCount(valid.length);
      setErrors(errs);
      setOpen(true);
      if (valid.length) toast.success(`Imported ${valid.length} student score${valid.length === 1 ? "" : "s"}`);
      if (errs.length) toast.warning(`${errs.length} row${errs.length === 1 ? "" : "s"} had errors`);
      onImported();
    } catch (e) {
      toast.error(`Parse failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const exportCurrent = (ext: "xlsx" | "csv") => {
    const rows = students.map(s => {
      const sc = currentScores[s.id] ?? { ca1: 0, ca2: 0, ca3: 0, exam: 0 };
      const total = (sc.ca1 || 0) + (sc.ca2 || 0) + (sc.ca3 || 0) + (sc.exam || 0);
      const grade = total >= 70 ? "A" : total >= 60 ? "B" : total >= 50 ? "C" : total >= 45 ? "D" : "F";
      return {
        AdmissionNo: s.admission_no,
        StudentName: s.full_name,
        "CA1 (max 20)": sc.ca1 || 0,
        "CA2 (max 20)": sc.ca2 || 0,
        "Exam (max 60)": sc.exam || 0,
        Total: total,
        Grade: grade,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Scores");
    XLSX.writeFile(wb, `scores-export.${ext}`, { bookType: ext });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      <Button variant="outline" size="sm" onClick={() => downloadTemplate("xlsx")} disabled={!ready || !students.length}>
        <FileSpreadsheet className="mr-2 size-4" />Template (xlsx)
      </Button>
      <Button variant="outline" size="sm" onClick={() => downloadTemplate("csv")} disabled={!ready || !students.length}>
        <FileSpreadsheet className="mr-2 size-4" />Template (csv)
      </Button>
      <Button variant="outline" size="sm" onClick={() => exportCurrent("xlsx")} disabled={!ready || !students.length}>
        <Download className="mr-2 size-4" />Export
      </Button>
      <Button size="sm" onClick={() => fileRef.current?.click()} disabled={!ready || busy}>
        <Upload className="mr-2 size-4" />{busy ? "Importing…" : "Import scores"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Import results</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3 text-sm">
              <CheckCircle2 className="size-4 text-primary" />
              <span><strong>{successCount}</strong> row{successCount === 1 ? "" : "s"} saved to database.</span>
            </div>
            {errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertCircle className="size-4" /> {errors.length} row{errors.length === 1 ? "" : "s"} skipped
                </div>
                <div className="max-h-72 overflow-y-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr><th className="px-3 py-2 text-left">Adm No</th><th className="px-3 py-2 text-left">Student</th><th className="px-3 py-2 text-left">Reason</th></tr>
                    </thead>
                    <tbody>
                      {errors.map((e, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2 font-mono text-xs">{e.admission_no}</td>
                          <td className="px-3 py-2">{e.full_name ?? "-"}</td>
                          <td className="px-3 py-2 text-destructive">{e.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
