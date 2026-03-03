"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, TestTube } from "lucide-react";
import type { ConfigRow, JobTemplate } from "@/lib/types";

const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export default function ConfigPage() {
  const [, setConfig] = useState<ConfigRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<ConfigRow> & { sproutgigs_username?: string; sproutgigs_password?: string }>({});

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((c) => {
        setConfig(c);
        setForm({
          ...c,
          sproutgigs_username: c.sproutgigs_username ?? "",
          sproutgigs_password: c.sproutgigs_password ?? "",
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const updated = await res.json();
        setConfig(updated);
        setForm({
          ...updated,
          sproutgigs_username: updated.sproutgigs_username ?? "",
          sproutgigs_password: updated.sproutgigs_password ?? "",
        });
      }
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      await save();
      const res = await fetch("/api/sproutgigs/test-connection", { method: "POST" });
      const json = await res.json();
      setTestResult(json.success ? `OK: ${json.activeJobsCount} active jobs` : json.error ?? "Failed");
    } catch (e) {
      setTestResult(String(e));
    } finally {
      setTesting(false);
    }
  }

  function update<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateTemplate(key: string, value: unknown) {
    setForm((f) => ({
      ...f,
      job_template: { ...(f.job_template as JobTemplate), [key]: value },
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const template = (form.job_template ?? {}) as JobTemplate;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Configuration</h1>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save
        </Button>
      </div>

      <Tabs defaultValue="schedule">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="demand">Demand</TabsTrigger>
          <TabsTrigger value="template">Job template</TabsTrigger>
          <TabsTrigger value="sproutgigs">SproutGigs</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Schedule settings</CardTitle>
              <CardDescription>When to run the daily check and operating window</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Timezone</Label>
                  <Input
                    value={form.timezone ?? ""}
                    onChange={(e) => update("timezone", e.target.value)}
                    placeholder="America/New_York"
                  />
                </div>
                <div>
                  <Label>Daily run time (HH:mm)</Label>
                  <Input
                    type="time"
                    value={form.run_time ?? "09:00"}
                    onChange={(e) => update("run_time", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Active days</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {DAYS.map((d) => (
                    <label key={d.value} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={(form.active_days ?? []).includes(d.value)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...(form.active_days ?? []), d.value]
                            : (form.active_days ?? []).filter((x) => x !== d.value);
                          update("active_days", next.sort((a, b) => a - b));
                        }}
                      />
                      <span className="text-sm">{d.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Operating start (HH:mm)</Label>
                  <Input
                    type="time"
                    value={form.operating_start ?? "09:00"}
                    onChange={(e) => update("operating_start", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Operating end (HH:mm)</Label>
                  <Input
                    type="time"
                    value={form.operating_end ?? "18:00"}
                    onChange={(e) => update("operating_end", e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.dry_run ?? true}
                  onCheckedChange={(c) => update("dry_run", c)}
                />
                <Label>Dry run (simulate launch, do not place orders)</Label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Max retries</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.retry_max ?? 3}
                    onChange={(e) => update("retry_max", parseInt(e.target.value, 10) || 0)}
                  />
                </div>
                <div>
                  <Label>Retry backoff (seconds)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.retry_backoff_base_seconds ?? 60}
                    onChange={(e) => update("retry_backoff_base_seconds", parseInt(e.target.value, 10) || 60)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demand" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Demand settings</CardTitle>
              <CardDescription>How many jobs to target per day and safety caps</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Daily target jobs</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.daily_target_jobs ?? 5}
                    onChange={(e) => update("daily_target_jobs", parseInt(e.target.value, 10) || 0)}
                  />
                </div>
                <div>
                  <Label>Max jobs per day</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.max_jobs_per_day ?? 10}
                    onChange={(e) => update("max_jobs_per_day", parseInt(e.target.value, 10) || 0)}
                  />
                </div>
                <div>
                  <Label>Min jobs per run</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.min_jobs_per_run ?? 1}
                    onChange={(e) => update("min_jobs_per_run", parseInt(e.target.value, 10) || 0)}
                  />
                </div>
                <div>
                  <Label>Max jobs per run</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.max_jobs_per_run ?? 5}
                    onChange={(e) => update("max_jobs_per_run", parseInt(e.target.value, 10) || 0)}
                  />
                </div>
              </div>
              <div>
                <Label>Demand source URL (optional)</Label>
                <Input
                  value={form.demand_source_url ?? ""}
                  onChange={(e) => update("demand_source_url", e.target.value || null)}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label>Launch spacing (seconds between launches)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.launch_spacing_seconds ?? 2}
                  onChange={(e) => update("launch_spacing_seconds", parseInt(e.target.value, 10) || 2)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="template" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Job template</CardTitle>
              <CardDescription>
                Use {"{{date}}"}, {"{{batch_number}}"}, {"{{job_index}}"} in text fields. For real API: zone_id (e.g. int), category_id (e.g. 0501), instructions, proofs, num_tasks, task_value.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={template.title ?? ""}
                  onChange={(e) => updateTemplate("title", e.target.value)}
                  placeholder="Job title {{date}}"
                />
              </div>
              <div>
                <Label>Description / notes</Label>
                <Textarea
                  value={template.description ?? ""}
                  onChange={(e) => updateTemplate("description", e.target.value)}
                  placeholder="Description with {{job_index}}"
                  rows={2}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Zone ID (API)</Label>
                  <Input
                    value={typeof template.zone_id === "string" ? template.zone_id : "int"}
                    onChange={(e) => updateTemplate("zone_id", e.target.value || "int")}
                    placeholder="int"
                  />
                </div>
                <div>
                  <Label>Category ID (API)</Label>
                  <Input
                    value={String(template.category_id ?? template.category ?? "")}
                    onChange={(e) => updateTemplate("category_id", e.target.value)}
                    placeholder="0501"
                  />
                </div>
                <div>
                  <Label>Task value (USD per task)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0.05}
                    value={typeof template.task_value === "number" ? template.task_value : typeof template.payout === "number" ? template.payout : ""}
                    onChange={(e) => updateTemplate("task_value", e.target.value ? Number(e.target.value) : undefined)}
                  />
                </div>
                <div>
                  <Label>Num tasks (min 10)</Label>
                  <Input
                    type="number"
                    min={10}
                    value={typeof template.num_tasks === "number" ? template.num_tasks : typeof template.quantity === "number" ? template.quantity : ""}
                    onChange={(e) => updateTemplate("num_tasks", e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  />
                </div>
              </div>
              <div>
                <Label>Instructions (one per line, for API)</Label>
                <Textarea
                  value={Array.isArray(template.instructions) ? template.instructions.join("\n") : (typeof template.instructions === "string" ? template.instructions : "")}
                  onChange={(e) => updateTemplate("instructions", e.target.value.split("\n").filter(Boolean))}
                  placeholder="Visit the URL&#10;Complete the task&#10;Submit screenshot"
                  rows={3}
                />
              </div>
              <Card className="bg-muted/50">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Preview (sample)</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <p><strong>Title:</strong> {(template.title ?? "").replace(/\{\{date\}\}/g, "2025-03-03").replace(/\{\{job_index\}\}/g, "0").replace(/\{\{batch_number\}\}/g, "1")}</p>
                  <p className="mt-1 truncate"><strong>Description:</strong> {(template.description ?? "").slice(0, 100)}...</p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sproutgigs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SproutGigs connection</CardTitle>
              <CardDescription>
                For the real API: use your <strong>User ID</strong> and <strong>API Secret</strong> from Account Settings → SETTINGS. Stored encrypted. Set SPROUTGIGS_USE_REAL_CLIENT=true to use the API.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>User ID (or username)</Label>
                <Input
                  type="text"
                  value={form.sproutgigs_username ?? ""}
                  onChange={(e) => update("sproutgigs_username", e.target.value)}
                  placeholder="API User ID from SproutGigs Settings"
                />
              </div>
              <div>
                <Label>API Secret (or password)</Label>
                <Input
                  type="password"
                  value={form.sproutgigs_password ?? ""}
                  onChange={(e) => update("sproutgigs_password", e.target.value)}
                  placeholder="••••••••"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground mt-1">Leave blank to keep existing. Set ENCRYPTION_KEY for encryption.</p>
              </div>
              <Button variant="outline" onClick={testConnection} disabled={testing}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TestTube className="h-4 w-4 mr-2" />}
                Test connection
              </Button>
              {testResult && <p className="text-sm">{testResult}</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
