import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    "/",
    "/config",
    "/runs",
    "/jobs",
    "/api/config",
    "/api/dashboard",
    "/api/runs/:path*",
    "/api/jobs/:path*",
    "/api/sproutgigs/:path*",
  ],
};
// /api/cron/* is not in matcher so Vercel Cron can call it with CRON_SECRET
