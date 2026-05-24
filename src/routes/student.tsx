import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { LayoutDashboard, FileText, User, GraduationCap as Loader } from "lucide-react";

export const Route = createFileRoute("/student")({ component: StudentLayout });

const items = [
  { to: "/student", label: "Dashboard", icon: <LayoutDashboard className="size-4" /> },
  { to: "/student/result", label: "My result", icon: <FileText className="size-4" /> },
  { to: "/student/profile", label: "Profile", icon: <User className="size-4" /> },
];

function StudentLayout() {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader className="size-8 animate-pulse text-primary" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (role !== "student" && role !== "admin") return <Navigate to="/" />;
  return <AppShell items={items} title="Student"><Outlet /></AppShell>;
}
