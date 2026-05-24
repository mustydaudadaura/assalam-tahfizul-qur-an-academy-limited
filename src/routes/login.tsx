import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    nav({ to: "/" });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden bg-sidebar p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2 text-sidebar-foreground">
          <GraduationCap className="size-8 text-sidebar-primary" />
          <span className="font-display text-2xl font-bold">HisGrace RPS</span>
        </div>
        <div className="space-y-4 text-sidebar-foreground">
          <h2 className="font-display text-4xl font-bold leading-tight">
            School result processing,<br />simplified.
          </h2>
          <p className="text-sidebar-foreground/70 max-w-md">
            Manage students, teachers, grades and report cards from one elegant dashboard.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">© HisGrace Academy</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold">Sign in</h1>
            <p className="text-sm text-muted-foreground">Access your dashboard</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            No account? <Link to="/signup" className="text-primary font-medium hover:underline">Create one</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
