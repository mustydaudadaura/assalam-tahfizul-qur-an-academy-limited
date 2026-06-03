import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { GraduationCap } from "lucide-react";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { user, role, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <GraduationCap className="size-10 animate-pulse text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (role === "super_admin") return <Navigate to="/super" />;
  if (role === "admin") return <Navigate to="/admin" />;
  if (role === "teacher") return <Navigate to="/teacher" />;
  if (role === "parent") return <Navigate to="/parent" />;
  return <Navigate to="/student" />;
}
