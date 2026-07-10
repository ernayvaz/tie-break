import { prisma } from "@/lib/db";
import { COMPETITIONS, getCompetitionLabel } from "@/lib/config";
import { RulesPremiumDocument } from "./rules-premium-document";

/** Bust any static caching of this page in edge/CDN during deploys. */
export const dynamic = "force-dynamic";

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
            value: "A correct 1/2 pick gives 1 point; a correct BTTS pick gives 2.",
          },
          {
            label: "Prizes",
            value: "League-specific prize details stay grouped in one place.",
          },
        ]}
      >
        <section className="space-y-4">
          <h2 className={sectionTitle}>Prediction options (1 – 2 – BTTS Yes – BTTS No)</h2>
          <p className="text-nord-polarLight">
            You choose exactly{" "}
            <strong className="font-semibold text-nord-polar">one</strong> option per match from
            the four below. Draw (X) is no longer a pick.
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-nord-polarLight">
            <li>
              <strong className="font-semibold text-nord-polar">1</strong> – Home team wins.
            </li>
            <li>
              <strong className="font-semibold text-nord-polar">2</strong> – Away team wins.
            </li>
            <li>
              <strong className="font-semibold text-nord-polar">BTTS Yes</strong> – Both teams
              score at least one goal.
            </li>
            <li>
              <strong className="font-semibold text-nord-polar">BTTS No</strong> – At most one
              team scores (including a goalless match).
            </li>
          </ul>
          <p className="text-nord-polarLight">
            A correct <strong className="font-semibold text-nord-polar">1</strong> or{" "}
            <strong className="font-semibold text-nord-polar">2</strong> is worth{" "}
            <strong className="font-semibold text-nord-polar">1 point</strong>, while a correct{" "}
            <strong className="font-semibold text-nord-polar">BTTS Yes</strong> or{" "}
            <strong className="font-semibold text-nord-polar">BTTS No</strong> is worth{" "}
            <strong className="font-semibold text-nord-polar">2 points</strong>.
          </p>
          <p className="text-nord-polarLight">
            <strong className="font-semibold text-nord-polar">1 and 2</strong> are decided by the
            match winner: 90 minutes, then extra time if played, and finally the penalty shootout
            if it is needed — the side that wins on penalties counts as 1 or 2.
          </p>
          <p className="text-nord-polarLight">
            <strong className="font-semibold text-nord-polar">
              BTTS Yes / BTTS No are decided by goals only.
            </strong>{" "}
            Goals scored in 90 minutes and extra time count; the penalty shootout does not count
            towards Both Teams To Score.
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
            Official results (score and 1/X/2) are shown only after the match has finished. A draw
            (X) can still be the official result of a match even though it is not a pick.
          </p>
        </section>

        <section className="space-y-3 pt-1">
          <h2 className={sectionTitle}>Scoring</h2>
          <p className="text-nord-polarLight">
            A correct <strong className="font-semibold text-nord-polar">1</strong> or{" "}
            <strong className="font-semibold text-nord-polar">2</strong> pick (matching the official
            winner) gives <strong className="font-semibold text-nord-polar">1 point</strong>. A
            correct <strong className="font-semibold text-nord-polar">BTTS Yes / BTTS No</strong>{" "}
            pick (matching whether both teams scored) gives{" "}
            <strong className="font-semibold text-nord-polar">2 points</strong>. Wrong or missing
            predictions give 0 points.
          </p>
          <p className="text-nord-polarLight">
            If you arm a <strong className="font-semibold text-nord-polar">Power Pick</strong> on a
            match, a correct pick scores exactly the Power Pick value instead (for example{" "}
            <strong className="font-semibold text-nord-polar">x5 = 5 points</strong>) — this applies
            the same way to 1, 2 and BTTS picks, and replaces the base points rather than stacking
            on top of them.
          </p>
        </section>

        <section className="space-y-3 pt-1">
          <h2 className={sectionTitle}>Power Pick multipliers</h2>
          <p className="text-nord-polarLight">
            Power Pick is a special booster available only in the{" "}
            <strong className="font-semibold text-nord-polar">World Cup</strong>{" "}
            competition. Admins can assign x3, x4, x5, x6 or x10 rights.
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-nord-polarLight">
            <li>
              Each Power Pick applies to a{" "}
              <strong className="font-semibold text-nord-polar">single match</strong>. If that
              boosted prediction is correct, it scores the assigned multiplier value
              (for example x6 ={" "}
              <strong className="font-semibold text-nord-polar">6 points</strong>) instead of the
              base points (1 for a 1/2 pick, 2 for BTTS). A wrong boosted prediction still scores 0.
            </li>
            <li>
              Power Pick rights are limited. You can hold at most{" "}
              <strong className="font-semibold text-nord-polar">10</strong> rights at a time, and
              they are granted by the administrator.
            </li>
            <li>
              A right is only consumed if your boosted prediction is{" "}
              <strong className="font-semibold text-nord-polar">finalized</strong> when the match
              locks. If the prediction is still a draft at lock time, the Power Pick is{" "}
              <strong className="font-semibold text-nord-polar">not used</strong> and the right is
              returned to you.
            </li>
            <li>
              You can change which match a Power Pick is applied to before that match locks. Once
              the match locks with a finalized boosted prediction, the right is spent.
            </li>
          </ul>
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
              {COMPETITIONS.map((competition) => {
                const compId = competition.id;
                const list = prizesByLeague[compId];
                if (!list?.length) return null;
                return (
                  <div key={compId}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-nord-polar">
                      {getCompetitionLabel(compId)}
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
