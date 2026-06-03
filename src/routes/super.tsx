import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { LayoutDashboard, Building2, CreditCard, ShieldCheck, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/super")({ component: SuperLayout });

const items = [
  { to: "/super", label: "Overview", icon: <LayoutDashboard className="size-4" /> },
  { to: "/super/schools", label: "Schools", icon: <Building2 className="size-4" /> },
  { to: "/super/subscriptions", label: "Subscriptions", icon: <CreditCard className="size-4" /> },
  { to: "/super/admins", label: "Super admins", icon: <ShieldCheck className="size-4" /> },
];

function SuperLayout() {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><GraduationCap className="size-8 animate-pulse text-primary" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (role !== "super_admin") return <Navigate to="/" />;
  return <AppShell items={items} title="Super Admin Console"><Outlet /></AppShell>;
}
