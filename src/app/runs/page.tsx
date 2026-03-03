"use client";

import { useEffect, useState } from "react";
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
import { Loader2, Search, Play } from "lucide-react";

interface RunRow {
  id: string;
  run_date: string;
  status: string;
  jobs_needed: number;
  jobs_launched: number;
  jobs_failed: number;
  created_at: string;
}

export default function RunsPage() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [executing, setExecuting] = useState<string | null>(null);

  function fetchRuns() {
    setLoading(true);
    fetch("/api/runs?limit=50")
      .then((r) => r.json())
      .then(setRuns)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchRuns();
  }, []);

  async function executeRun(runId: string) {
    setExecuting(runId);
    try {
      await fetch("/api/runs/" + runId + "/execute", { method: "POST" });
      fetchRuns();
    } finally {
      setExecuting(null);
    }
  }

  const filtered = query
    ? runs.filter(
        (r) =>
          r.run_date.includes(query) ||
          r.id.toLowerCase().includes(query.toLowerCase()) ||
          r.status.toLowerCase().includes(query.toLowerCase())
      )
    : runs;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Runs & History</h1>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by date or ID..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 w-64"
            />
          </div>
          <Button variant="outline" size="sm" onClick={fetchRuns} disabled={loading}>
            <Loader2 className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily runs</CardTitle>
          <CardDescription>Click a run to see tasks and job details</CardDescription>
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
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Jobs needed</TableHead>
                  <TableHead>Launched</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link href={"/runs/" + r.id} className="font-medium text-primary hover:underline">
                        {r.run_date}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.status === "completed" ? "default" : r.status === "failed" ? "destructive" : "secondary"
                        }
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.jobs_needed}</TableCell>
                    <TableCell>{r.jobs_launched}</TableCell>
                    <TableCell>{r.jobs_failed}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {(r.status === "queued" || r.status === "running") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => executeRun(r.id)}
                          disabled={executing === r.id}
                        >
                          {executing === r.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!loading && filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No runs found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
