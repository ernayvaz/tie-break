import Link from "next/link";
import { Button, Card, CardContent } from "@/components/ui";

const tieBreakTools = [
  {
    title: "Match Management",
    description: "Import and manage tournament fixtures used on the Schedule and prediction flows.",
    href: "/admin/matches",
    variant: "primary" as const,
  },
  {
    title: "Prediction Management",
    description: "Review previous-match prediction history, timestamps, and manual overrides for TIE-BREAK tournament matches.",
    href: "/admin/predictions",
    variant: "primary" as const,
  },
  {
    title: "Scoring",
    description: "Recalculate TIE-BREAK points and leaderboard after results change.",
    href: "/admin/scoring",
    variant: "secondary" as const,
  },
  {
    title: "API & Sync",
    description: "Sync matches and data from football-data.org.",
    href: "/admin/api",
    variant: "secondary" as const,
  },
];

export default function AdminTieBreakHubPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-nord-polar">TIE-BREAK</h1>
      <p className="mt-2 text-sm text-nord-polarLight">
        Tournament prediction mode: manage schedule-based matches, predictions, scoring, and data
        sync.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {tieBreakTools.map((tool) => (
          <Card key={tool.href}>
            <CardContent className="py-4">
              <h2 className="text-sm font-medium text-nord-polar">{tool.title}</h2>
              <p className="mt-1 text-sm text-nord-polarLight">{tool.description}</p>
              <Button asChild variant={tool.variant} className="mt-3">
                <Link href={tool.href}>{tool.title}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
