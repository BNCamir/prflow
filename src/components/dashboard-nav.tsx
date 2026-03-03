"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Settings, History, Briefcase, LogOut } from "lucide-react";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/config", label: "Configuration", icon: Settings },
  { href: "/runs", label: "Runs & History", icon: History },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
];

export function DashboardNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return (
    <header className="border-b bg-card">
      <div className="container flex h-14 items-center justify-between px-4">
        <nav className="flex items-center gap-6">
          <Link href="/" className="font-semibold text-lg text-foreground">
            SproutGigs
          </Link>
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                pathname === href ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut className="h-4 w-4 mr-1" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
