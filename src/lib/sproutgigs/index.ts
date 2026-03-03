import type { ISproutGigsClient } from "./client-interface";
import { MockSproutGigsClient } from "./mock-client";
import { SproutGigsApiClient } from "./api-client";
import type { SproutGigsApiAuth } from "./types";

const USE_REAL_CLIENT = process.env.SPROUTGIGS_USE_REAL_CLIENT === "true";

/** Auth from config: use username as user_id and password as api_secret for the API */
export function getSproutGigsClient(
  auth?: { username?: string; password?: string } | null
): ISproutGigsClient {
  if (USE_REAL_CLIENT && auth?.username && auth?.password) {
    const apiAuth: SproutGigsApiAuth = { user_id: auth.username, api_secret: auth.password };
    return new SproutGigsApiClient(apiAuth);
  }
  return new MockSproutGigsClient();
}

export type { ISproutGigsClient };
export type { SproutGigsJobConfig, SproutGigsActiveJob, SproutGigsLaunchResult } from "./types";
