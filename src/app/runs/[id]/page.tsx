"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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
import { Loader2, ArrowLeft } from "lucide-react";

interface RunDetail {
  run: {
    id: string;
    run_date: string;
    status: string;
    jobs_needed: number;
    jobs_launched: number;
    jobs_failed: number;
    errors: unknown;
    started_at: string | null;
    ended_at: string | null;
  };
  jobs: { id: string; job_index: number; status: string; external_job_id: string | null; error: string | null }[];
  tasks: { id: string; type: string; status: string; last_error: string | null; attempts: number }[];
}

export default function RunDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    fetch("/api/runs?id=" + encodeURIComponent(id))
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  async function execute() {
    setExecuting(true);
    try {
      await fetch("/api/runs/" + id + "/execute", { method: "POST" });
      const res = await fetch("/api/runs?id=" + encodeURIComponent(id));
      setData(await res.json());
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
  if (!data?.run) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Run not found.</p>
        <Button asChild variant="link">
          <Link href="/runs">Back to runs</Link>
        </Button>
      </div>
    );
  }

  const { run, jobs, tasks } = data;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/runs">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Run {run.run_date}</h1>
          <p className="text-muted-foreground">ID: {run.id}</p>
        </div>
        {(run.status === "queued" || run.status === "running") && (
          <Button onClick={execute} disabled={executing}>
            {executing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Process tasks
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>Status and counts</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge variant={run.status === "completed" ? "default" : run.status === "failed" ? "destructive" : "secondary"}>
              {run.status}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Jobs needed</p>
            <p className="text-lg font-semibold">{run.jobs_needed}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Jobs launched</p>
            <p className="text-lg font-semibold">{run.jobs_launched}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Jobs failed</p>
            <p className="text-lg font-semibold">{run.jobs_failed}</p>
          </div>
          {run.started_at && (
            <div>
              <p className="text-sm text-muted-foreground">Started</p>
              <p className="text-sm">{new Date(run.started_at).toLocaleString()}</p>
            </div>
          )}
          {run.ended_at && (
            <div>
              <p className="text-sm text-muted-foreground">Ended</p>
              <p className="text-sm">{new Date(run.ended_at).toLocaleString()}</p>
            </div>
          )}
          {run.errors && Array.isArray(run.errors) && run.errors.length > 0 ? (
            <div className="sm:col-span-2">
              <p className="text-sm text-muted-foreground">Errors</p>
              <pre className="text-xs bg-destructive/10 p-2 rounded overflow-auto max-h-24">
                {JSON.stringify(run.errors, null, 2)}
              </pre>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jobs</CardTitle>
          <CardDescription>Per-job status and external IDs</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>External ID</TableHead>
                <TableHead>Error</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell>{j.job_index}</TableCell>
                  <TableCell>
                    <Badge variant={j.status === "launched" ? "default" : j.status === "failed" ? "destructive" : "secondary"}>
                      {j.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{j.external_job_id ?? "—"}</TableCell>
                  <TableCell className="text-destructive text-sm">{j.error ?? "—"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={"/jobs?runId=" + run.id}>View in Jobs</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>Queue tasks for this run</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Last error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.type}</TableCell>
                  <TableCell>
                    <Badge variant={t.status === "success" ? "default" : t.status === "failed" ? "destructive" : "secondary"}>
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{t.attempts}</TableCell>
                  <TableCell className="text-destructive text-sm">{t.last_error ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
