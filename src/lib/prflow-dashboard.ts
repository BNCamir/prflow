import { SproutGigsApiClient } from "@/lib/sproutgigs/api-client";
import type { SproutGigsActiveJob } from "@/lib/sproutgigs/types";
import { parseJobJson, titleMatchesConfig } from "@/lib/cron-reddit-quora-engine";
import type { SproutGigsJobConfig } from "@/lib/sproutgigs/types";

export type PrFlowSlot = "reddit" | "redditSysco" | "quora";

export type PrFlowConfiguredRow = {
  slot: PrFlowSlot;
  label: string;
  title: string;
  state: "active" | "inactive";
  matchedJob?: { id: string; title: string; status: string; tasks_done?: number; num_tasks?: number };
};

export type PrFlowSnapshot = {
  connected: boolean;
  error?: string;
  spendableUsd: number | null;
  jobs: SproutGigsActiveJob[];
  configured: PrFlowConfiguredRow[];
};

function pickJobForConfig(
  config: SproutGigsJobConfig,
  slot: PrFlowSlot,
  jobs: SproutGigsActiveJob[]
): SproutGigsActiveJob | undefined {
  const titleLower = config.title.toLowerCase();
  const broadQuora = slot === "quora";
  return jobs.find((j) => {
    const t = j.title.toLowerCase();
    if (titleMatchesConfig(t, titleLower)) return true;
    if (broadQuora && t.includes("quora")) return true;
    return false;
  });
}

export async function buildPrFlowSnapshot(): Promise<PrFlowSnapshot> {
  const redditRaw =
    process.env.REDDIT_JOB_JSON?.trim() ||
    process.env.REDDIT_JOB_CONFIG?.trim();
  const redditSyscoRaw =
    process.env.REDDIT_JOB_SYSCO_JSON?.trim() ||
    process.env.REDDIT_JOB_SYSCO_CONFIG?.trim();
  const redditConfig = parseJobJson("REDDIT", redditRaw);
  const redditSyscoConfig = parseJobJson("REDDIT_SYSCO", redditSyscoRaw);
  const quoraConfig = parseJobJson("QUORA", process.env.QUORA_JOB_JSON);

  const userId = process.env.SPROUTGIGS_USER_ID;
  const apiSecret = process.env.SPROUTGIGS_API_SECRET;
  if (!userId || !apiSecret) {
    const configured: PrFlowConfiguredRow[] = [];
    const addOffline = (slot: PrFlowSlot, label: string, cfg: SproutGigsJobConfig | null) => {
      if (!cfg) return;
      configured.push({ slot, label, title: cfg.title, state: "inactive" });
    };
    addOffline("reddit", "Reddit (general)", redditConfig);
    addOffline("redditSysco", "Reddit (Sysco/RD)", redditSyscoConfig);
    addOffline("quora", "Quora", quoraConfig);
    return { connected: false, spendableUsd: null, jobs: [], configured };
  }

  const client = new SproutGigsApiClient({ user_id: userId, api_secret: apiSecret });
  let spendableUsd: number | null = null;
  let jobs: SproutGigsActiveJob[] = [];
  let error: string | undefined;

  try {
    spendableUsd = await client.getSpendableBalance();
    const running = await client.getJobsByStatus("running", 5);
    const pendingA = await client.getJobsByStatus("pending_approval", 2);
    const pendingR = await client.getJobsByStatus("pending_review", 2);
    const byId = new Map<string, SproutGigsActiveJob>();
    for (const j of [...running, ...pendingA, ...pendingR]) byId.set(j.id, j);
    jobs = Array.from(byId.values());
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const configured: PrFlowConfiguredRow[] = [];
  const add = (slot: PrFlowSlot, label: string, cfg: SproutGigsJobConfig | null) => {
    if (!cfg) return;
    const matched = jobs.length ? pickJobForConfig(cfg, slot, jobs) : undefined;
    configured.push({
      slot,
      label,
      title: cfg.title,
      state: matched ? "active" : "inactive",
      matchedJob: matched
        ? {
            id: matched.id,
            title: matched.title,
            status: matched.status,
            tasks_done: matched.tasks_done,
            num_tasks: matched.num_tasks,
          }
        : undefined,
    });
  };
  add("reddit", "Reddit (general)", redditConfig);
  add("redditSysco", "Reddit (Sysco/RD)", redditSyscoConfig);
  add("quora", "Quora", quoraConfig);

  return {
    connected: true,
    error,
    spendableUsd,
    jobs,
    configured,
  };
}
