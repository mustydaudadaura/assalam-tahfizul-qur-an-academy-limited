export const calcGrade = (total: number): string => {
  if (total >= 70) return "A";
  if (total >= 60) return "B";
  if (total >= 50) return "C";
  if (total >= 45) return "D";
  return "F";
};

export const gradeRemark = (grade: string): string => ({
  A: "Excellent", B: "Very Good", C: "Good", D: "Pass", F: "Fail",
}[grade] ?? "");

export interface ResultRow {
  subject_id: string;
  subject_name: string;
  ca1: number;
  ca2: number;
  exam: number;
  total: number;
  grade: string;
  position?: number;
  highest?: number;
  lowest?: number;
  class_average?: number;
}

export const ordinal = (n: number): string => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
};
