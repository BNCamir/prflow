"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw, RotateCw, Search } from "lucide-react";

interface JobRow {
  id: string;
  run_id: string;
  job_index: number;
  status: string;
  external_job_id: string | null;
  error: string | null;
  run_date: string;
  created_at: string;
}

function JobsContent() {
  const searchParams = useSearchParams();
  const runIdParam = searchParams.get("runId") ?? "";
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [retrying, setRetrying] = useState<string | null>(null);

  function fetchJobs() {
    setLoading(true);
    const url = runIdParam ? "/api/jobs?runId=" + encodeURIComponent(runIdParam) : "/api/jobs?limit=100";
    fetch(url)
      .then((r) => r.json())
      .then(setJobs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runIdParam]);

  async function retry(jobId: string) {
    setRetrying(jobId);
    try {
      const res = await fetch("/api/jobs/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (res.ok) fetchJobs();
    } finally {
      setRetrying(null);
    }
  }

  const filtered = query
    ? jobs.filter(
        (j) =>
          j.external_job_id?.toLowerCase().includes(query.toLowerCase()) ||
          j.run_date.includes(query) ||
          j.status.toLowerCase().includes(query.toLowerCase())
      )
    : jobs;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Jobs</h1>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 w-56"
            />
          </div>
          <Button variant="outline" size="sm" onClick={fetchJobs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Launched jobs</CardTitle>
          <CardDescription>
            All jobs created by the system. Retry respects dry run and daily caps.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run date</TableHead>
                  <TableHead>#</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>External ID</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell>
                      <Link href={"/runs/" + j.run_id} className="text-primary hover:underline">
                        {j.run_date}
                      </Link>
                    </TableCell>
                    <TableCell>{j.job_index}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          j.status === "launched" ? "default" : j.status === "failed" ? "destructive" : "secondary"
                        }
                      >
                        {j.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{j.external_job_id ?? "—"}</TableCell>
                    <TableCell className="text-destructive text-sm max-w-[200px] truncate">
                      {j.error ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(j.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {j.status === "failed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => retry(j.id)}
                          disabled={retrying === j.id}
                        >
                          {retrying === j.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCw className="h-4 w-4" />
                          )}
                          Retry
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!loading && filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No jobs found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <JobsContent />
    </Suspense>
  );
}
