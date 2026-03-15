import { Card, CardContent } from "@/components/ui";
import { RecalculateScoresButton } from "../recalculate-scores-button";

export default function AdminScoringPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-nord-polar">Scoring</h1>
      <p className="mt-2 text-sm text-nord-polarLight">
        Recalculate points for finished matches and refresh the leaderboard. Tie-break: total points, then accuracy.
      </p>
      <Card className="mt-6">
        <CardContent className="py-6">
          <RecalculateScoresButton />
        </CardContent>
      </Card>
    </div>
  );
}
