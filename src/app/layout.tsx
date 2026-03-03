import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { DashboardNav } from "@/components/dashboard-nav";

export const metadata: Metadata = {
  title: "SproutGigs Dashboard",
  description: "Automate daily job launching on SproutGigs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          <div className="relative min-h-screen">
            <DashboardNav />
            <main className="container mx-auto px-4 py-6">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
