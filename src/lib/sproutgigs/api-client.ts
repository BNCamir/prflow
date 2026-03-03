/**
 * Real SproutGigs API client.
 * @see https://sproutgigs.com/api/documentation.php
 * Rate limit: 1 request per second. Auth: Basic base64(user_id:api_secret).
 */

import type { ISproutGigsClient } from "./client-interface";
import type {
  SproutGigsApiAuth,
  SproutGigsJobConfig,
  SproutGigsActiveJob,
  SproutGigsLaunchResult,
} from "./types";

const BASE = "https://sproutgigs.com/api";
const RATE_LIMIT_MS = 1100;

function b64(s: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(s, "utf8").toString("base64");
  return btoa(unescape(encodeURIComponent(s)));
}

export class SproutGigsApiClient implements ISproutGigsClient {
  private lastCall = 0;
  private auth: SproutGigsApiAuth;

  constructor(auth: SproutGigsApiAuth) {
    if (!auth?.user_id || !auth?.api_secret) {
      throw new Error("SproutGigs API requires user_id and api_secret");
    }
    this.auth = auth;
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCall;
    if (elapsed < RATE_LIMIT_MS) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed));
    }
    this.lastCall = Date.now();
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown; query?: Record<string, string> } = {}
  ): Promise<T> {
    await this.throttle();
    const creds = b64(`${this.auth.user_id}:${this.auth.api_secret}`);
    const url = `${BASE}${path}${options.query ? "?" + new URLSearchParams(options.query).toString() : ""}`;
    const res = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 10000));
      return this.request(path, options);
    }

    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
    }

    if (!res.ok) {
      const msg = typeof data === "object" && data && "message" in data
        ? String((data as { message: string }).message)
        : text.slice(0, 200);
      throw new Error(`SproutGigs API ${res.status}: ${msg}`);
    }
    return data as T;
  }

  async checkCurrentActiveJobs(): Promise<SproutGigsActiveJob[]> {
    const data = await this.request<{ jobs?: { id: string; title: string; status: string; created_at?: string; num_tasks?: number; tasks_done?: number }[] }>(
      "/jobs/get-jobs.php",
      { query: { status: "running" } }
    );
    const jobs = data.jobs ?? [];
    return jobs.map((j) => ({
      id: j.id,
      title: j.title,
      status: j.status,
      createdAt: j.created_at,
      num_tasks: j.num_tasks,
      tasks_done: j.tasks_done,
    }));
  }

  async checkDraftsOrPending(): Promise<SproutGigsActiveJob[]> {
    const data = await this.request<{ jobs?: { id: string; title: string; status: string }[] }>(
      "/jobs/get-jobs.php",
      { query: { status: "pending_approval" } }
    );
    return (data.jobs ?? []).map((j) => ({ id: j.id, title: j.title, status: j.status }));
  }

  async getSpendableBalance(): Promise<number> {
    const data = await this.request<{ spendable?: string }>("/users/get-balances.php");
    return parseFloat(data.spendable ?? "0") || 0;
  }

  async getJobStatus(jobId: string): Promise<{ status: string; [key: string]: unknown }> {
    const data = await this.request<{ status?: string }>("/jobs/get-job.php", {
      query: { job_id: jobId },
    });
    return { status: data.status ?? "unknown", ...data };
  }

  async launchJob(jobConfig: SproutGigsJobConfig): Promise<SproutGigsLaunchResult> {
    const zone_id = jobConfig.zone_id ?? "int";
    const category_id = jobConfig.category_id ?? "0501";
    const title = String(jobConfig.title ?? "Job").slice(0, 255);
    const instructions = Array.isArray(jobConfig.instructions)
      ? jobConfig.instructions
      : [String(jobConfig.description ?? "Complete the task.")];
    const proofs = Array.isArray(jobConfig.proofs) && jobConfig.proofs.length > 0
      ? jobConfig.proofs.map((p) => ({
          type: p.type === "screenshot" ? "screenshot" : "text",
          description: String(p.description ?? "Proof"),
        }))
      : [{ type: "screenshot" as const, description: "Screenshot of completed task" }];
    const num_tasks = Math.max(10, Math.min(9999, Number(jobConfig.num_tasks) || 25));
    const task_value = Math.max(0.05, Number(jobConfig.task_value) ?? 0.10);
    const speed = Math.max(1, Math.min(1000, Number(jobConfig.speed) ?? 1000));
    const ttr = Math.max(1, Math.min(90, Number(jobConfig.ttr) ?? 7));
    const hold_time = Math.max(5, Math.min(90, Number(jobConfig.hold_time) ?? 15));

    const body: Record<string, unknown> = {
      zone_id,
      category_id,
      title,
      instructions,
      proofs,
      num_tasks,
      task_value,
      speed,
      ttr,
      hold_time,
      notes: String(jobConfig.notes ?? "").slice(0, 500),
    };
    if (jobConfig.list_id) body.list_id = jobConfig.list_id;
    if (Array.isArray(jobConfig.excluded_countries) && jobConfig.excluded_countries.length > 0) {
      body.excluded_countries = jobConfig.excluded_countries;
    }

    const data = await this.request<{ ok?: boolean; url?: string; message?: string }>(
      "/jobs/post-job.php",
      { method: "POST", body }
    );

    if (data.ok && data.url) {
      const jobId = data.url.match(/Id=([a-f0-9]+)/i)?.[1] ?? data.url;
      return { success: true, jobId, url: data.url };
    }
    return { success: false, error: data.message ?? "Post job failed" };
  }
}
