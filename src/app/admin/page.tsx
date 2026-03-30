import Link from "next/link";
import { Button, Card, CardContent } from "@/components/ui";

export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-nord-polar">Admin</h1>
      <p className="mt-2 text-sm text-nord-polarLight">
        Choose a game mode or platform area. TIE-BREAK covers tournament predictions (Schedule
        flow). Halisaha mode covers the pitch prediction experience.
      </p>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-nord-polarLight">
          TIE-BREAK
        </h2>
        <p className="mt-1 text-sm text-nord-polarLight">
          Tournament prediction mode: matches, predictions, scoring, and API sync.
        </p>
        <div className="mt-4">
          <Card>
            <CardContent className="py-4">
              <h3 className="text-sm font-medium text-nord-polar">TIE-BREAK administration</h3>
              <p className="mt-1 text-sm text-nord-polarLight">
                Open the hub for match management, prediction tools, scoring, and football-data sync.
              </p>
              <Button asChild className="mt-3">
                <Link href="/admin/tie-break">Open TIE-BREAK tools</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-nord-polarLight">
          HALISAHA MODE
        </h2>
        <p className="mt-1 text-sm text-nord-polarLight">
          Halisaha predictions, questions, MVP flow, and match-day setup.
        </p>
        <div className="mt-4">
          <Card>
            <CardContent className="py-4">
              <h3 className="text-sm font-medium text-nord-polar">Halisaha Management</h3>
              <p className="mt-1 text-sm text-nord-polarLight">
                Active match, squad, questions, resolution, and scoring for Halisaha mode.
              </p>
              <Button asChild className="mt-3">
                <Link href="/admin/halisaha">Halisaha Management</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-nord-polarLight">
          Platform
        </h2>
        <p className="mt-1 text-sm text-nord-polarLight">
          Accounts, prizes, invites, and audit trail across the product.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="py-4">
              <h3 className="text-sm font-medium text-nord-polar">User Management</h3>
              <p className="mt-1 text-sm text-nord-polarLight">Approve accounts and manage roles.</p>
              <Button asChild variant="secondary" className="mt-3">
                <Link href="/admin/users">User Management</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <h3 className="text-sm font-medium text-nord-polar">Prize Management</h3>
              <p className="mt-1 text-sm text-nord-polarLight">Configure prizes and competitions.</p>
              <Button asChild variant="secondary" className="mt-3">
                <Link href="/admin/prizes">Prize Management</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <h3 className="text-sm font-medium text-nord-polar">Invite link</h3>
              <p className="mt-1 text-sm text-nord-polarLight">Generate and copy invite links.</p>
              <Button asChild variant="secondary" className="mt-3">
                <Link href="/admin/invite">Invite link</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <h3 className="text-sm font-medium text-nord-polar">Audit Log</h3>
              <p className="mt-1 text-sm text-nord-polarLight">Review admin and system actions.</p>
              <Button asChild variant="secondary" className="mt-3">
                <Link href="/admin/audit">Audit Log</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
