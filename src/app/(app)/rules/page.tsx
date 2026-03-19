import { prisma } from "@/lib/db";
import { UCL_COMPETITION_ID, OTHER_COMPETITION_ID } from "@/lib/config";
import { RulesPremiumDocument } from "./rules-premium-document";

/** Bust any static caching of this page in edge/CDN during deploys. */
export const dynamic = "force-dynamic";

const LEAGUE_LABELS: Record<string, string> = {
  [UCL_COMPETITION_ID]: "UEFA Champions League",
  [OTHER_COMPETITION_ID]: "Diğer",
};
export default async function RulesPage() {
  const prizes = await prisma.prize.findMany({ orderBy: [{ competitionId: "asc" }, { place: "asc" }] });
  const prizesByLeague = prizes.reduce<Record<string, typeof prizes>>((acc, p) => {
    if (!acc[p.competitionId]) acc[p.competitionId] = [];
    acc[p.competitionId].push(p);
    return acc;
  }, {});

  const sectionTitle =
    "text-[11px] font-semibold uppercase tracking-[0.16em] text-nord-frostDark";

  return (
    <div className="max-w-4xl">
      <RulesPremiumDocument
        eyebrow="Premium Guide"
        title="Rules & prizes"
        description="A clearer premium guide to prediction rules, scoring logic, tie-breaks and league prize details."
        highlights={[
          {
            label: "Scoring",
            value: "Every correct 1/X/2 prediction gives 1 point.",
          },
          {
            label: "Prizes",
            value: "League-specific prize details stay grouped in one place.",
          },
        ]}
      >
        <section className="space-y-4">
          <h2 className={sectionTitle}>Prediction options (1 – X – 2)</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-nord-polarLight">
            <li>
              <strong className="font-semibold text-nord-polar">1</strong> – Home team wins.
            </li>
            <li>
              <strong className="font-semibold text-nord-polar">X</strong> – Draw.
            </li>
            <li>
              <strong className="font-semibold text-nord-polar">2</strong> – Away team wins.
            </li>
          </ul>
          <p className="text-nord-polarLight">
            <strong className="font-semibold text-nord-polar">
              X is correct only when the official result of the match is a draw.
            </strong>{" "}
            If the match goes to extra time or penalties and a winner is decided, the result is not X; it becomes 1 or 2. In two-legged ties, aggregate score does not matter. Only the official result of that specific match (90 minutes + extra time if played, no penalties) counts.
          </p>
        </section>

        <section className="space-y-3 pt-1">
          <h2 className={sectionTitle}>Lock rule</h2>
          <p className="text-nord-polarLight">
            Predictions lock exactly 5 minutes before the match start. After that time, you cannot change your prediction for that match.
          </p>
        </section>

        <section className="space-y-3 pt-1">
          <h2 className={sectionTitle}>Final confirmation</h2>
          <p className="text-nord-polarLight">
            Before a prediction is final, you must confirm it. Once confirmed, your prediction for that match is locked and cannot be changed.
          </p>
        </section>

        <section className="space-y-3 pt-1">
          <h2 className={sectionTitle}>Prediction visibility</h2>
          <p className="text-nord-polarLight">
            You cannot see other users’ predictions for a match until you have finalized your own prediction for that match. After finalizing, you can see other users’ finalized predictions for that match. Draft or non-final predictions of others are never visible.
          </p>
          <p className="text-nord-polarLight">
            Official results (score and 1/X/2) are shown only after the match has finished.
          </p>
        </section>

        <section className="space-y-3 pt-1">
          <h2 className={sectionTitle}>Scoring</h2>
          <p className="text-nord-polarLight">
            A correct prediction (your pick equals the official result 1/X/2) gives 1 point. Wrong or missing prediction gives 0 points.
          </p>
        </section>

        <section className="space-y-3 pt-1">
          <h2 className={sectionTitle}>Tie-break</h2>
          <p className="text-nord-polarLight">
            If two or more users have the same total points, they are ranked by{" "}
            <strong className="font-semibold text-nord-polar">accuracy</strong>: accuracy = correct predictions ÷ finalized predictions (a ratio, not a sum). Higher accuracy ranks higher. If still equal, they share the same rank.
          </p>
        </section>

        <section className="space-y-4 pt-1">
          <h2 className={sectionTitle}>Prizes</h2>
          {prizes.length > 0 ? (
            <div className="space-y-5">
              {([UCL_COMPETITION_ID, OTHER_COMPETITION_ID] as const).map((compId) => {
                const list = prizesByLeague[compId];
                if (!list?.length) return null;
                const label = LEAGUE_LABELS[compId] ?? compId;
                return (
                  <div key={compId}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-nord-polar">
                      {label}
                    </h3>
                    <ul className="list-disc space-y-1.5 pl-5 text-nord-polarLight">
                      {list.map((p) => (
                        <li key={p.id}>
                          <strong className="font-semibold text-nord-polar">{p.title}</strong>
                          {p.description && ` – ${p.description}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-nord-polarLight">Prize details will be announced by the administrator.</p>
          )}
        </section>
      </RulesPremiumDocument>
    </div>
  );
}
