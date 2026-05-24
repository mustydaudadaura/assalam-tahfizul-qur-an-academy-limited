import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { LayoutDashboard, ClipboardList, CalendarCheck, BookOpen, GraduationCap as Loader } from "lucide-react";

export const Route = createFileRoute("/teacher")({ component: TeacherLayout });

const items = [
  { to: "/teacher", label: "Dashboard", icon: <LayoutDashboard className="size-4" /> },
  { to: "/teacher/scores", label: "Enter scores", icon: <ClipboardList className="size-4" /> },
  { to: "/teacher/attendance", label: "Attendance", icon: <CalendarCheck className="size-4" /> },
  { to: "/teacher/assignments", label: "My subjects", icon: <BookOpen className="size-4" /> },
];

function TeacherLayout() {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader className="size-8 animate-pulse text-primary" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (role !== "teacher" && role !== "admin") return <Navigate to="/" />;
  return <AppShell items={items} title="Teacher"><Outlet /></AppShell>;
}
