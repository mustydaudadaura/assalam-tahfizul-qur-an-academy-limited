import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (!data) throw new Error("Forbidden: super admin only");
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

export const createSchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    name: z.string().min(2).max(120),
    slug: z.string().max(60).optional(),
    phone: z.string().max(40).optional().nullable(),
    email: z.string().email().optional().nullable(),
    address: z.string().max(255).optional().nullable(),
    motto: z.string().max(255).optional().nullable(),
    plan: z.enum(["trial", "starter", "standard", "premium", "enterprise"]).default("trial"),
    billing_cycle: z.enum(["monthly", "yearly"]).default("monthly"),
    price_ngn: z.number().min(0).default(0),
    seats: z.number().int().min(1).max(100000).default(100),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const slug = (data.slug && data.slug.length ? data.slug : slugify(data.name)) || `school-${Date.now()}`;
    const { data: school, error } = await supabaseAdmin.from("schools").insert({
      name: data.name, slug, phone: data.phone ?? null, email: data.email ?? null,
      address: data.address ?? null, motto: data.motto ?? null, is_active: true,
    }).select().single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("school_subscriptions").upsert({
      school_id: school.id, plan: data.plan, billing_cycle: data.billing_cycle,
      price_ngn: data.price_ngn, seats: data.seats, status: "active",
    });
    return { id: school.id, slug: school.slug };
  });

export const updateSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    school_id: z.string().uuid(),
    plan: z.enum(["trial", "starter", "standard", "premium", "enterprise"]),
    status: z.enum(["active", "past_due", "suspended", "cancelled", "expired"]),
    billing_cycle: z.enum(["monthly", "yearly"]),
    price_ngn: z.number().min(0),
    seats: z.number().int().min(1).max(100000),
    current_period_end: z.string(),
    notes: z.string().max(2000).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("school_subscriptions").upsert({
      ...data, notes: data.notes ?? null,
    }, { onConflict: "school_id" });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("schools").update({ is_active: data.status === "active" }).eq("id", data.school_id);
    return { ok: true };
  });

export const assignSchoolAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    school_id: z.string().uuid(),
    email: z.string().email(),
    password: z.string().min(6).max(72),
    full_name: z.string().min(1).max(120),
    phone: z.string().max(40).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find or create user
    const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("email", data.email).maybeSingle();
    let uid = existing?.id as string | undefined;
    if (!uid) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email, password: data.password, email_confirm: true,
        user_metadata: { full_name: data.full_name, role: "admin", school_id: data.school_id },
      });
      if (error) throw new Error(error.message);
      uid = created.user!.id;
    }
    await supabaseAdmin.from("profiles").update({ full_name: data.full_name, phone: data.phone ?? null }).eq("id", uid!);
    await supabaseAdmin.from("user_roles").upsert({ user_id: uid!, role: "admin" }, { onConflict: "user_id,role" } as any);
    await supabaseAdmin.from("user_schools").upsert({ user_id: uid!, school_id: data.school_id } as any, { onConflict: "user_id,school_id" } as any);
    await supabaseAdmin.from("user_active_school").upsert({ user_id: uid!, school_id: data.school_id });
    return { user_id: uid };
  });

export const bootstrapSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ email: z.string().email().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "super_admin");
    const isBootstrap = (count ?? 0) === 0;
    if (!isBootstrap) {
      // require caller to already be super_admin
      await assertSuperAdmin(context.userId);
    }
    let targetId = context.userId;
    if (data.email) {
      const { data: p } = await supabaseAdmin.from("profiles").select("id").eq("email", data.email).maybeSingle();
      if (!p) throw new Error("User not found. Ask them to sign up first.");
      targetId = p.id;
    }
    await supabaseAdmin.from("user_roles").upsert({ user_id: targetId, role: "super_admin" } as any, { onConflict: "user_id,role" } as any);
    return { user_id: targetId, bootstrap: isBootstrap };
  });

export const deleteSchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ school_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("schools").delete().eq("id", data.school_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
