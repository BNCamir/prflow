"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, Play, Loader2 } from "lucide-react";

interface PrFlowConfiguredRow {
  slot: string;
  label: string;
  title: string;
  state: "active" | "inactive";
  matchedJob?: {
    id: string;
    title: string;
    status: string;
    tasks_done?: number;
    num_tasks?: number;
  };
}

interface PrFlowData {
  connected: boolean;
  error?: string;
  spendableUsd: number | null;
  jobs: {
    id: string;
    title: string;
    status: string;
    tasks_done?: number;
    num_tasks?: number;
  }[];
  configured: PrFlowConfiguredRow[];
}

interface DashboardData {
  legacyAvailable: boolean;
  runsAttempted: number;
  jobsNeeded: number;
  jobsLaunched: number;
  jobsFailed: number;
  todayRunId: string | null;
  todayRunStatus: string | null;
  actions: { id: string; job_index: number; status: string; external_job_id?: string; error?: string }[];
  nextScheduledRun: string | null;
  recentActivity: { id: string; action: string; details: unknown; created_at: string; run_id?: string }[];
  envCronRunsToday: number;
  prFlow: PrFlowData;
  summary: {
    prFlowConnected: boolean;
    sproutGigsRunningCount: number;
    prTemplatesConfigured: number;
    prTemplatesActive: number;
    prTemplatesInactive: number;
  };
}

const POLL_INTERVAL = 15000;

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [executing, setExecuting] = useState(false);

  async function fetchDashboard() {
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboard();
    const t = setInterval(fetchDashboard, POLL_INTERVAL);
    return () => clearInterval(t);
  }, []);

  async function runNow() {
    setRunning(true);
    try {
      const res = await fetch("/api/runs/now", { method: "POST" });
      const json = await res.json();
      if (res.ok && json.mode === "env_cron") {
        await fetchDashboard();
        return;
      }
      if (res.ok && json.runId && json.mode === "legacy") {
        await fetch("/api/runs/" + json.runId + "/execute", { method: "POST" });
        await fetchDashboard();
      }
    } finally {
      setRunning(false);
    }
  }

  async function executeRun() {
    if (!data?.todayRunId) return; // data may be null before first load
    setExecuting(true);
    try {
      await fetch("/api/runs/" + data.todayRunId + "/execute", { method: "POST" });
      await fetchDashboard();
    } finally {
      setExecuting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Could not load dashboard. Check the API or try Refresh.
      </div>
    );
  }

  const pr = data.prFlow;
  const showPr = pr && (pr.connected || pr.configured.length > 0);
  const runningOnSg =
    pr?.jobs.filter((j) => String(j.status).toLowerCase() === "running").length ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchDashboard} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          {data.legacyAvailable && data.todayRunId && (
            <Button size="sm" onClick={executeRun} disabled={executing}>
              {executing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              Process tasks
            </Button>
          )}
          <Button size="sm" onClick={runNow} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
            Run now
          </Button>
        </div>
      </div>

      {showPr && (
        <>
          <div>
            <h2 className="text-lg font-semibold mb-3">PR flow (SproutGigs)</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Live data from your SproutGigs account and job templates in Railway env (
              <code className="text-xs">REDDIT_JOB_CONFIG</code>, <code className="text-xs">QUORA_JOB_JSON</code>
              , etc.).
            </p>
          </div>

          {pr?.error && (
            <Card className="border-destructive/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-destructive">SproutGigs API</CardTitle>
                <CardDescription>{pr.error}</CardDescription>
              </CardHeader>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Spendable balance</CardDescription>
                <CardTitle className="text-3xl">
                  {pr?.spendableUsd != null ? `$${pr.spendableUsd.toFixed(2)}` : "—"}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Jobs running (SproutGigs)</CardDescription>
                <CardTitle className="text-3xl">{runningOnSg}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Templates active / configured</CardDescription>
                <CardTitle className="text-3xl">
                  {data.summary.prTemplatesActive} / {data.summary.prTemplatesConfigured}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Run now (env cron) today</CardDescription>
                <CardTitle className="text-3xl">{data.envCronRunsToday}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {!pr?.connected && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Connect SproutGigs</CardTitle>
                <CardDescription>
                  Set <code className="text-xs">SPROUTGIGS_USER_ID</code> and{" "}
                  <code className="text-xs">SPROUTGIGS_API_SECRET</code> on Railway to load live balances and jobs.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {pr && pr.configured.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Job templates vs SproutGigs</CardTitle>
                <CardDescription>
                  Whether each env template matches a running / pending job (same logic as the cron checker).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Slot</TableHead>
                      <TableHead>Template title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>On SproutGigs</TableHead>
                      <TableHead>Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pr.configured.map((row) => (
                      <TableRow key={row.slot}>
                        <TableCell className="text-muted-foreground">{row.label}</TableCell>
                        <TableCell className="font-medium">{row.title}</TableCell>
                        <TableCell>
                          <Badge variant={row.state === "active" ? "default" : "secondary"}>
                            {row.state === "active" ? "Active" : "Not running"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.matchedJob
                            ? `${row.matchedJob.title} (${row.matchedJob.status})`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.matchedJob?.num_tasks != null
                            ? `${row.matchedJob.tasks_done ?? 0} / ${row.matchedJob.num_tasks}`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {pr && pr.jobs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Relevant SproutGigs jobs</CardTitle>
                <CardDescription>Running, pending approval, and pending review (deduplicated).</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Tasks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pr.jobs.map((j) => (
                      <TableRow key={j.id}>
                        <TableCell className="max-w-[240px] truncate">{j.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{j.status}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{j.id}</TableCell>
                        <TableCell className="text-sm">
                          {j.num_tasks != null ? `${j.tasks_done ?? 0} / ${j.num_tasks}` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {data.legacyAvailable && (
        <>
          <h2 className="text-lg font-semibold pt-2">Legacy run (database)</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Runs attempted today</CardDescription>
                <CardTitle className="text-3xl">{data.runsAttempted}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Jobs needed</CardDescription>
                <CardTitle className="text-3xl">{data.jobsNeeded}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Jobs launched</CardDescription>
                <CardTitle className="text-3xl">{data.jobsLaunched}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Jobs failed</CardDescription>
                <CardTitle className="text-3xl">{data.jobsFailed}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {data.nextScheduledRun && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Next scheduled run (config)</CardTitle>
                <CardDescription>
                  {new Date(data.nextScheduledRun).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {data.actions && data.actions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Today&apos;s actions</CardTitle>
                <CardDescription>Job launch status for today&apos;s run</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>External ID</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.actions.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.job_index}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              a.status === "launched" ? "default" : a.status === "failed" ? "destructive" : "secondary"
                            }
                          >
                            {a.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{a.external_job_id ?? "—"}</TableCell>
                        <TableCell className="text-destructive text-sm">{a.error ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>From the database (Run now, cron, legacy runs)</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {(data.recentActivity ?? []).map((log) => (
              <li key={log.id} className="flex items-center gap-2 text-sm border-b pb-2">
                <span className="text-muted-foreground shrink-0">
                  {new Date(log.created_at).toLocaleTimeString()}
                </span>
                <Badge variant="outline">{log.action}</Badge>
                {log.details && typeof log.details === "object" ? (
                  <span className="text-muted-foreground truncate">{JSON.stringify(log.details)}</span>
                ) : null}
              </li>
            ))}
            {(!data.recentActivity || data.recentActivity.length === 0) && (
              <li className="text-muted-foreground text-sm">
                {data.legacyAvailable
                  ? "No activity yet."
                  : "No database activity (DATABASE_URL optional for PR-only flow)."}
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
