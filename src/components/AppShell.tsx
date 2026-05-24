import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, Moon, Sun, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem { to: string; label: string; icon: ReactNode; }

export function AppShell({ items, title, children }: {
  items: NavItem[]; title: string; children: ReactNode;
}) {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );

  const toggleDark = () => {
    const d = !dark;
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
          <GraduationCap className="size-6 text-sidebar-primary" />
          <span className="font-display text-lg font-bold">HisGrace RPS</span>
        </div>
        <nav className="space-y-1 p-4">
          {items.map((item) => {
            const active = loc.pathname === item.to ||
              (item.to !== "/" + role && loc.pathname.startsWith(item.to));
            return (
              <Link key={item.to} to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}>
                {item.icon}{item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-4 left-4 right-4 space-y-2">
          <div className="rounded-md bg-sidebar-accent p-3 text-xs">
            <div className="font-medium truncate">{user?.email}</div>
            <div className="text-sidebar-foreground/60 capitalize">{role}</div>
          </div>
          <Button onClick={handleSignOut} variant="ghost" size="sm"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <LogOut className="mr-2 size-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(!open)}>
              <Menu className="size-5" />
            </Button>
            <h1 className="font-display text-xl font-semibold">{title}</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleDark}>
            {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
    </div>
  );
}
