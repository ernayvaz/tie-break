"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconAdmin,
  IconHalisaha,
  IconLeaderboard,
  IconNavApi,
  IconNavAudit,
  IconNavInvite,
  IconNavOverview,
  IconNavPlatform,
  IconNavPrize,
  IconNavScoring,
  IconNavUsers,
  IconPredictions,
  IconRules,
  IconSchedule,
} from "@/components/icons/nav-icons";

const platformItems = [
  { href: "/schedule", label: "Schedule", Icon: IconSchedule },
  { href: "/leaderboard", label: "Leaderboard", Icon: IconLeaderboard },
  { href: "/predictions", label: "My predictions", Icon: IconPredictions },
  { href: "/rules", label: "Rules & prizes", Icon: IconRules },
] as const;

const tieBreakAdminItems = [
  { href: "/admin/tie-break", label: "Overview", Icon: IconNavOverview },
  { href: "/admin/matches", label: "Match Management", Icon: IconSchedule },
  { href: "/admin/predictions", label: "Prediction Management", Icon: IconPredictions },
  { href: "/admin/scoring", label: "Scoring", Icon: IconNavScoring },
  { href: "/admin/api", label: "API & Sync", Icon: IconNavApi },
] as const;

const halisahaAdminItems = [
  { href: "/admin/halisaha", label: "Halisaha Management", Icon: IconHalisaha },
  { href: "/admin/halisaha/predictions", label: "Prediction History", Icon: IconPredictions },
] as const;

const platformAdminItems = [
  { href: "/admin/users", label: "User Management", Icon: IconNavUsers },
  { href: "/admin/prizes", label: "Prize Management", Icon: IconNavPrize },
  { href: "/admin/invite", label: "Invite link", Icon: IconNavInvite },
  { href: "/admin/audit", label: "Audit Log", Icon: IconNavAudit },
] as const;

function isTieBreakAdminPath(pathname: string) {
  return (
    pathname.startsWith("/admin/tie-break") ||
    pathname.startsWith("/admin/matches") ||
    pathname.startsWith("/admin/predictions") ||
    pathname.startsWith("/admin/scoring") ||
    pathname.startsWith("/admin/api")
  );
}

function isHalisahaAdminPath(pathname: string) {
  return pathname.startsWith("/admin/halisaha");
}

function isPlatformAdminPath(pathname: string) {
  return (
    pathname.startsWith("/admin/users") ||
    pathname.startsWith("/admin/prizes") ||
    pathname.startsWith("/admin/invite") ||
    pathname.startsWith("/admin/audit")
  );
}

function isTournamentPath(pathname: string) {
  if (pathname.startsWith("/admin")) return false;
  return (
    pathname.startsWith("/schedule") ||
    pathname.startsWith("/leaderboard") ||
    pathname.startsWith("/predictions") ||
    pathname.startsWith("/rules")
  );
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 text-nord-polarLight transition-transform duration-200 ${
        expanded ? "rotate-180" : ""
      }`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function AccordionHeader({
  id,
  title,
  leading,
  expanded,
  onToggle,
}: {
  id: string;
  title: string;
  leading: ReactNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      id={`${id}-header`}
      aria-expanded={expanded}
      aria-controls={`${id}-panel`}
      onClick={onToggle}
      className="flex w-full min-w-0 items-center gap-2 rounded-lg py-1.5 pl-0.5 pr-1 text-left transition-colors hover:bg-nord-snow/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
    >
      <span className="flex shrink-0 items-center text-nord-frost-dark [&_svg]:h-[14px] [&_svg]:w-[14px]">
        {leading}
      </span>
      <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-nord-polar-mid underline decoration-nord-frost-dark/55 decoration-1 underline-offset-[5px]">
        {title}
      </span>
      <Chevron expanded={expanded} />
    </button>
  );
}

function iconWrap(node: ReactNode) {
  return <span className="flex shrink-0 text-nord-polarLight [&_svg]:h-[15px] [&_svg]:w-[15px]">{node}</span>;
}

function NavLink({
  href,
  label,
  pathname,
  icon,
}: {
  href: string;
  label: string;
  pathname: string;
  icon?: ReactNode;
}) {
  const isActive =
    href === "/admin"
      ? pathname === "/admin"
      : href === "/admin/tie-break"
        ? pathname === "/admin/tie-break"
        : href === "/admin/halisaha"
          ? pathname === "/admin/halisaha"
          : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      title={label}
      className={`group flex min-w-0 items-center gap-2 rounded-[10px] px-2.5 py-2 text-sm whitespace-nowrap transition-colors ${
        isActive
          ? "bg-nord-snow font-medium text-nord-polar shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] ring-1 ring-black/[0.04]"
          : "text-nord-polarLight hover:bg-nord-snow/70 hover:text-nord-polar"
      }`}
    >
      {icon ? (
        <span
          className={`shrink-0 transition-[color,opacity] ${
            isActive
              ? "text-nord-frost-dark opacity-100"
              : "text-nord-polar-lighter opacity-[0.58] group-hover:opacity-100 group-hover:text-nord-polar-mid"
          }`}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  );
}

type OpenState = {
  tournament: boolean;
  tieBreak: boolean;
  halisaha: boolean;
  platform: boolean;
};

export function AdminNav() {
  const pathname = usePathname();

  const [open, setOpen] = useState<OpenState>({
    tournament: true,
    tieBreak: false,
    halisaha: false,
    platform: false,
  });

  useEffect(() => {
    setOpen((prev) => ({
      tournament: prev.tournament || isTournamentPath(pathname),
      tieBreak: prev.tieBreak || isTieBreakAdminPath(pathname),
      halisaha: prev.halisaha || isHalisahaAdminPath(pathname),
      platform: prev.platform || isPlatformAdminPath(pathname),
    }));
  }, [pathname]);

  return (
    <nav className="flex flex-1 flex-col p-4">
      <div>
        <Link
          href="/schedule"
          className="block rounded-lg px-3 py-2 text-lg font-light uppercase tracking-[0.22em] text-nord-polar hover:text-nord-frostDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
        >
          TIE-BREAK
        </Link>

        <div className="px-0.5">
          <AccordionHeader
            id="nav-tournament"
            title="Tournament predictions"
            expanded={open.tournament}
            onToggle={() => setOpen((o) => ({ ...o, tournament: !o.tournament }))}
            leading={
              <span
                className="block h-3 w-0.5 shrink-0 rounded-full bg-gradient-to-b from-[var(--nord-frost-light)] to-nord-frost-dark"
                aria-hidden
              />
            }
          />
          {open.tournament ? (
            <div
              id="nav-tournament-panel"
              role="region"
              aria-labelledby="nav-tournament-header"
              className="mt-1 space-y-0.5"
            >
              {platformItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.Icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={`flex min-w-0 items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-sm whitespace-nowrap transition-colors ${
                      isActive
                        ? "bg-nord-snow font-medium text-nord-polar shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] ring-1 ring-black/[0.04]"
                        : "text-nord-polarLight hover:bg-nord-snow/70 hover:text-nord-polar"
                    }`}
                  >
                    <span className="shrink-0">
                      <Icon />
                    </span>
                    <span className="min-w-0 truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="my-5 h-px shrink-0 bg-gradient-to-r from-transparent via-nord-polarLighter/35 to-transparent"
        aria-hidden
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="rounded-[12px] border border-[var(--border)]/80 bg-gradient-to-br from-white via-nord-snow/25 to-nord-snow/70 px-3 py-2.5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_8px_24px_-12px_rgba(46,52,64,0.12)]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/95 text-nord-frost-dark ring-1 ring-black/[0.05]">
              <span className="[&_svg]:h-[15px] [&_svg]:w-[15px]">
                <IconAdmin />
              </span>
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-nord-polar">Admin</p>
              <p className="mt-0.5 text-[11px] font-normal normal-case tracking-normal text-nord-polarLight">
                Console &amp; settings
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-0.5 px-0.5">
          <NavLink href="/admin" label="Dashboard" pathname={pathname} icon={iconWrap(<IconAdmin />)} />
        </div>

        <div className="mt-2 px-0.5">
          <AccordionHeader
            id="nav-tie-break"
            title="TIE-BREAK"
            expanded={open.tieBreak}
            onToggle={() => setOpen((o) => ({ ...o, tieBreak: !o.tieBreak }))}
            leading={<IconLeaderboard />}
          />
          {open.tieBreak ? (
            <div
              id="nav-tie-break-panel"
              role="region"
              aria-labelledby="nav-tie-break-header"
              className="ml-1 mt-1 space-y-0.5 border-l border-[var(--border)]/70 pl-2.5"
            >
              {tieBreakAdminItems.map((item) => {
                const Icon = item.Icon;
                return (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    pathname={pathname}
                    icon={iconWrap(<Icon />)}
                  />
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="mt-2 px-0.5">
          <AccordionHeader
            id="nav-halisaha"
            title="HALISAHA MODE"
            expanded={open.halisaha}
            onToggle={() => setOpen((o) => ({ ...o, halisaha: !o.halisaha }))}
            leading={<IconHalisaha />}
          />
          {open.halisaha ? (
            <div
              id="nav-halisaha-panel"
              role="region"
              aria-labelledby="nav-halisaha-header"
              className="ml-1 mt-1 space-y-0.5 border-l border-[var(--border)]/70 pl-2.5"
            >
              {halisahaAdminItems.map((item) => {
                const Icon = item.Icon;
                return (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    pathname={pathname}
                    icon={iconWrap(<Icon />)}
                  />
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="mt-2 px-0.5">
          <AccordionHeader
            id="nav-platform"
            title="PLATFORM"
            expanded={open.platform}
            onToggle={() => setOpen((o) => ({ ...o, platform: !o.platform }))}
            leading={<IconNavPlatform />}
          />
          {open.platform ? (
            <div
              id="nav-platform-panel"
              role="region"
              aria-labelledby="nav-platform-header"
              className="ml-1 mt-1 space-y-0.5 border-l border-[var(--border)]/70 pl-2.5"
            >
              {platformAdminItems.map((item) => {
                const Icon = item.Icon;
                return (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    pathname={pathname}
                    icon={iconWrap(<Icon />)}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
