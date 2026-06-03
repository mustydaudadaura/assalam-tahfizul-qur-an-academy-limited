import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapSuperAdmin } from "@/lib/super-admin.functions";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/super/bootstrap")({ component: Bootstrap });

function Bootstrap() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const fn = useServerFn(bootstrapSuperAdmin);

  const { data: hasSuper, isLoading } = useQuery({
    queryKey: ["has-super"],
    queryFn: async () => {
      const { count } = await supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "super_admin");
      return (count ?? 0) > 0;
    },
  });

  const mut = useMutation({
    mutationFn: () => fn({ data: {} }),
    onSuccess: async () => {
      toast.success("You are now super admin. Reloading...");
      await supabase.auth.refreshSession();
      setTimeout(() => { window.location.href = "/super"; }, 600);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading || isLoading) return <div className="p-10 text-center text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (hasSuper) return <Navigate to="/" />;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md w-full p-8 text-center">
        <ShieldCheck className="mx-auto size-12 text-primary" />
        <h1 className="mt-4 font-display text-2xl font-bold">Claim super admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No super admin exists on this platform yet. Claim it now to manage schools and subscriptions.
        </p>
        <Button className="mt-6 w-full" onClick={() => mut.mutate()} disabled={mut.isPending}>
          Make me super admin
        </Button>
      </Card>
    </div>
  );
}
