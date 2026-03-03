export interface SproutGigsJobConfig {
  title: string;
  description?: string;
  /** SproutGigs category_id (e.g. "0501", "2004") - required for post-job */
  category_id?: string;
  /** Zone id (e.g. "int") or list_id - required for post-job */
  zone_id?: string;
  list_id?: number;
  /** Payment per task in USD */
  task_value?: number;
  /** Number of tasks (min 10) */
  num_tasks?: number;
  /** Instructions shown to workers (array of strings) */
  instructions?: string[];
  /** Proofs required: { type: "text"|"screenshot", description: string }[] */
  proofs?: { type: string; description: string }[];
  /** Excluded country codes (e.g. ["pk","bd"]) */
  excluded_countries?: string[];
  speed?: number;
  ttr?: number;
  hold_time?: number;
  notes?: string;
  [key: string]: unknown;
}

export interface SproutGigsActiveJob {
  id: string;
  title: string;
  status: string;
  createdAt?: string;
  num_tasks?: number;
  tasks_done?: number;
}

export interface SproutGigsLaunchResult {
  success: boolean;
  jobId?: string;
  url?: string;
  error?: string;
}

/** API auth: user_id and api_secret from Account Settings > SETTINGS */
export interface SproutGigsApiAuth {
  user_id: string;
  api_secret: string;
}
