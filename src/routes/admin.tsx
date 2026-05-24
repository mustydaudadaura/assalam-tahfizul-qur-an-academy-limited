import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { LayoutDashboard, Users, GraduationCap, BookOpen, School, Calendar, ClipboardList, FileSpreadsheet, Settings, UserCog } from "lucide-react";
import { GraduationCap as Loader } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

const items = [
  { to: "/admin", label: "Dashboard", icon: <LayoutDashboard className="size-4" /> },
  { to: "/admin/students", label: "Students", icon: <Users className="size-4" /> },
  { to: "/admin/teachers", label: "Teachers", icon: <UserCog className="size-4" /> },
  { to: "/admin/classes", label: "Classes", icon: <School className="size-4" /> },
  { to: "/admin/subjects", label: "Subjects", icon: <BookOpen className="size-4" /> },
  { to: "/admin/sessions", label: "Sessions & Terms", icon: <Calendar className="size-4" /> },
  { to: "/admin/results", label: "Results", icon: <ClipboardList className="size-4" /> },
  { to: "/admin/broadsheet", label: "Broadsheet", icon: <FileSpreadsheet className="size-4" /> },
  { to: "/admin/settings", label: "Settings", icon: <Settings className="size-4" /> },
];

function AdminLayout() {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader className="size-8 animate-pulse text-primary" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (role !== "admin") return <Navigate to="/" />;
  return <AppShell items={items} title="Administrator"><Outlet /></AppShell>;
}
