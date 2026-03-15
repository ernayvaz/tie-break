import Link from "next/link";
import { Button, Card, CardContent } from "@/components/ui";

export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-nord-polar">Admin</h1>
      <p className="mt-2 text-sm text-nord-polarLight">
        Manage users, matches, and platform settings.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="py-4">
            <h2 className="text-sm font-medium text-nord-polar">Invite</h2>
            <p className="mt-1 text-sm text-nord-polarLight">Generate and copy invite links.</p>
            <Button asChild className="mt-3">
              <Link href="/admin/invite">Invite link</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <h2 className="text-sm font-medium text-nord-polar">API & Sync</h2>
            <p className="mt-1 text-sm text-nord-polarLight">Sync matches from football-data.org.</p>
            <Button asChild variant="secondary" className="mt-3">
              <Link href="/admin/api">API & Sync</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <h2 className="text-sm font-medium text-nord-polar">Scoring</h2>
            <p className="mt-1 text-sm text-nord-polarLight">Recalculate points and leaderboard.</p>
            <Button asChild variant="secondary" className="mt-3">
              <Link href="/admin/scoring">Scoring</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
