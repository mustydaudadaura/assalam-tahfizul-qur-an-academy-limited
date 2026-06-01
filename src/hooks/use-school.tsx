import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

interface School { id: string; name: string; slug: string; logo_url: string | null; }

interface SchoolCtx {
  schoolId: string | null;
  school: School | null;
  schools: School[];
  loading: boolean;
  switchSchool: (id: string) => Promise<void>;
}

const Ctx = createContext<SchoolCtx>({
  schoolId: null, school: null, schools: [], loading: true, switchSchool: async () => {},
});

export function SchoolProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setSchoolId(null); setSchools([]); setLoading(false); return; }
    setLoading(true);
    const [{ data: links }, { data: active }] = await Promise.all([
      supabase.from("user_schools").select("school_id, schools(id, name, slug, logo_url)").eq("user_id", user.id),
      supabase.from("user_active_school").select("school_id").eq("user_id", user.id).maybeSingle(),
    ]);
    const list = (links ?? []).map((l: any) => l.schools).filter(Boolean) as School[];
    setSchools(list);
    const activeId = active?.school_id ?? list[0]?.id ?? null;
    setSchoolId(activeId);
    if (activeId && !active) {
      await supabase.from("user_active_school").upsert({ user_id: user.id, school_id: activeId });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const switchSchool = async (id: string) => {
    if (!user) return;
    await supabase.from("user_active_school").upsert({ user_id: user.id, school_id: id });
    setSchoolId(id);
    window.location.reload();
  };

  return (
    <Ctx.Provider value={{
      schoolId, school: schools.find(s => s.id === schoolId) ?? null,
      schools, loading, switchSchool,
    }}>{children}</Ctx.Provider>
  );
}

export const useSchool = () => useContext(Ctx);
