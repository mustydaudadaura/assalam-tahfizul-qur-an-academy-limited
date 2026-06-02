import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { LayoutDashboard, FileText, GraduationCap as Loader } from "lucide-react";

export const Route = createFileRoute("/parent")({ component: ParentLayout });

const items = [
  { to: "/parent", label: "Dashboard", icon: <LayoutDashboard className="size-4" /> },
  { to: "/parent/results", label: "Children's results", icon: <FileText className="size-4" /> },
];

function ParentLayout() {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader className="size-8 animate-pulse text-primary" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (role !== "parent" && role !== "admin") return <Navigate to="/" />;
  return <AppShell items={items} title="Parent"><Outlet /></AppShell>;
}
