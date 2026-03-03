import { NextResponse } from "next/server";
import { getOrCreateConfig, getDecryptedAuth } from "@/lib/config-service";
import { getSproutGigsClient } from "@/lib/sproutgigs";

export async function POST() {
  try {
    const config = await getOrCreateConfig();
    const auth = getDecryptedAuth(config);
    const client = getSproutGigsClient(auth);
    const active = await client.checkCurrentActiveJobs();
    return NextResponse.json({
      success: true,
      message: "Connection OK",
      activeJobsCount: active.length,
    });
  } catch (e) {
    console.error("Test connection failed", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Connection failed" },
      { status: 500 }
    );
  }
}
