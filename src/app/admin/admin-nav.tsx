"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconSchedule, IconLeaderboard, IconPredictions, IconRules } from "@/components/icons/nav-icons";

const platformItems = [
  { href: "/schedule", label: "Schedule", Icon: IconSchedule },
  { href: "/leaderboard", label: "Leaderboard", Icon: IconLeaderboard },
  { href: "/predictions", label: "My predictions", Icon: IconPredictions },
  { href: "/rules", label: "Rules & prizes", Icon: IconRules },
] as const;

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "User Management" },
  { href: "/admin/matches", label: "Match Management" },
  { href: "/admin/predictions", label: "Prediction Management" },
  { href: "/admin/prizes", label: "Prize Management" },
  { href: "/admin/scoring", label: "Scoring" },
  { href: "/admin/api", label: "API & Sync" },
  { href: "/admin/invite", label: "Invite link" },
  { href: "/admin/audit", label: "Audit Log" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="p-4 space-y-1 flex-1 flex flex-col">
      <div className="mb-2">
        <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-nord-polarLight">
          Tie-Break Platform
        </p>
        {platformItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.Icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-nord-snow ${
                isActive
                  ? "bg-nord-snow text-nord-polar font-medium"
                  : "text-nord-polarLight hover:text-nord-polar"
              }`}
            >
              <Icon />
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="border-t border-nord-polarLighter/30 pt-2 mt-2">
        <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-nord-polarLight">
          Admin
        </p>
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm hover:bg-nord-snow ${
                isActive
                  ? "bg-nord-snow text-nord-polar font-medium"
                  : "text-nord-polarLight hover:text-nord-polar"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
