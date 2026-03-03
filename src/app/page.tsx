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

interface DashboardData {
  runsAttempted: number;
  jobsNeeded: number;
  jobsLaunched: number;
  jobsFailed: number;
  todayRunId: string | null;
  todayRunStatus: string | null;
  actions: { id: string; job_index: number; status: string; external_job_id?: string; error?: string }[];
  nextScheduledRun: string | null;
  recentActivity: { id: string; action: string; details: unknown; created_at: string; run_id?: string }[];
}

const POLL_INTERVAL = 10000;

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
      if (res.ok && json.runId) {
        await fetch("/api/runs/" + json.runId + "/execute", { method: "POST" });
        await fetchDashboard();
      }
    } finally {
      setRunning(false);
    }
  }

  async function executeRun() {
    if (!data?.todayRunId) return;
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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchDashboard} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          {data?.todayRunId && (
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Runs attempted today</CardDescription>
            <CardTitle className="text-3xl">{data?.runsAttempted ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Jobs needed</CardDescription>
            <CardTitle className="text-3xl">{data?.jobsNeeded ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Jobs launched</CardDescription>
            <CardTitle className="text-3xl">{data?.jobsLaunched ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Jobs failed</CardDescription>
            <CardTitle className="text-3xl">{data?.jobsFailed ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {data?.nextScheduledRun && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Next scheduled run</CardTitle>
            <CardDescription>
              {new Date(data.nextScheduledRun).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {data?.actions && data.actions.length > 0 && (
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
                      <Badge variant={a.status === "launched" ? "default" : a.status === "failed" ? "destructive" : "secondary"}>
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

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Live feed (polling every 10s)</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {(data?.recentActivity ?? []).map((log) => (
              <li key={log.id} className="flex items-center gap-2 text-sm border-b pb-2">
                <span className="text-muted-foreground shrink-0">
                  {new Date(log.created_at).toLocaleTimeString()}
                </span>
                <Badge variant="outline">{log.action}</Badge>
                {log.details && typeof log.details === "object" ? (
                  <span className="text-muted-foreground truncate">
                    {JSON.stringify(log.details)}
                  </span>
                ) : null}
              </li>
            ))}
            {(!data?.recentActivity || data.recentActivity.length === 0) && (
              <li className="text-muted-foreground text-sm">No activity yet.</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
