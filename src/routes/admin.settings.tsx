import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["settings"], queryFn: async () => (await supabase.from("school_settings").select("*").eq("id", 1).single()).data });
  const [form, setForm] = useState<any>({});
  useEffect(() => { if (data) setForm(data); }, [data]);

  const upload = async (file: File, bucket: string, field: string) => {
    const path = `${field}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
    setForm({ ...form, [field]: publicUrl });
    toast.success("Uploaded");
  };

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("school_settings").update({
        school_name: form.school_name, motto: form.motto, address: form.address,
        phone: form.phone, email: form.email, website: form.website,
        section_label: form.section_label,
        logo_url: form.logo_url, secondary_logo_url: form.secondary_logo_url,
        principal_name: form.principal_name, principal_signature_url: form.principal_signature_url,
      }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="font-display text-2xl font-bold">School settings</h2>
      <Card className="p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label>School name</Label><Input value={form.school_name ?? ""} onChange={e => setForm({ ...form, school_name: e.target.value })} /></div>
          <div><Label>Section label</Label><Input placeholder="Nursery / Primary / Secondary School" value={form.section_label ?? ""} onChange={e => setForm({ ...form, section_label: e.target.value })} /></div>
          <div><Label>Motto</Label><Input value={form.motto ?? ""} onChange={e => setForm({ ...form, motto: e.target.value })} /></div>
          <div><Label>Website</Label><Input value={form.website ?? ""} onChange={e => setForm({ ...form, website: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Address</Label><Input value={form.address ?? ""} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.phone ?? ""} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>Email</Label><Input value={form.email ?? ""} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Principal name</Label><Input value={form.principal_name ?? ""} onChange={e => setForm({ ...form, principal_name: e.target.value })} /></div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>Primary logo</Label>
            {form.logo_url && <img src={form.logo_url} alt="logo" className="my-2 h-20 w-20 rounded object-contain bg-muted" />}
            <Input type="file" accept="image/*" onChange={e => e.target.files?.[0] && upload(e.target.files[0], "logos", "logo_url")} />
          </div>
          <div>
            <Label>Secondary logo / emblem</Label>
            {form.secondary_logo_url && <img src={form.secondary_logo_url} alt="emblem" className="my-2 h-20 w-20 rounded object-contain bg-muted" />}
            <Input type="file" accept="image/*" onChange={e => e.target.files?.[0] && upload(e.target.files[0], "logos", "secondary_logo_url")} />
          </div>
          <div>
            <Label>Principal signature</Label>
            {form.principal_signature_url && <img src={form.principal_signature_url} alt="signature" className="my-2 h-20 w-32 object-contain bg-muted" />}
            <Input type="file" accept="image/*" onChange={e => e.target.files?.[0] && upload(e.target.files[0], "signatures", "principal_signature_url")} />
          </div>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="mr-2 size-4" />Save settings</Button>
      </Card>
    </div>
  );
}
