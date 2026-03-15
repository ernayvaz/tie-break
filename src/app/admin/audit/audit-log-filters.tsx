import Link from "next/link";

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "user_approved", label: "User approved" },
  { value: "user_rejected", label: "User rejected" },
  { value: "user_blocked", label: "User blocked" },
  { value: "user_unblocked", label: "User unblocked" },
  { value: "username_updated", label: "Username updated" },
  { value: "pin_reset", label: "PIN reset" },
  { value: "user_deleted", label: "User deleted" },
  { value: "match_created", label: "Match created" },
  { value: "match_updated", label: "Match updated" },
  { value: "match_deleted", label: "Match deleted" },
  { value: "match_result_manual", label: "Match result (manual)" },
  { value: "prediction_points_override", label: "Prediction points override" },
];

const TARGET_OPTIONS = [
  { value: "", label: "All targets" },
  { value: "user", label: "User" },
  { value: "match", label: "Match" },
  { value: "prediction", label: "Prediction" },
];

type Props = {
  actionType?: string;
  targetType?: string;
};

export function AuditLogFilters({ actionType = "", targetType = "" }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-nord-polarLighter/50 bg-nord-snow/50 px-4 py-3">
      <span className="text-sm font-medium text-nord-polar">Filters:</span>
      <form method="get" className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="text-sm text-nord-polarLight">Action</span>
          <select
            name="actionType"
            defaultValue={actionType}
            className="rounded-lg border border-nord-polarLighter bg-white px-3 py-1.5 text-sm text-nord-polar focus:border-nord-frostDark focus:outline-none focus:ring-1 focus:ring-nord-frostDark"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm text-nord-polarLight">Target type</span>
          <select
            name="targetType"
            defaultValue={targetType}
            className="rounded-lg border border-nord-polarLighter bg-white px-3 py-1.5 text-sm text-nord-polar focus:border-nord-frostDark focus:outline-none focus:ring-1 focus:ring-nord-frostDark"
          >
            {TARGET_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg border border-nord-polarLighter bg-white px-3 py-1.5 text-sm font-medium text-nord-polar hover:bg-nord-snow focus:outline-none focus:ring-1 focus:ring-nord-frostDark"
        >
          Apply
        </button>
      </form>
      {(actionType || targetType) && (
        <Link
          href="/admin/audit"
          className="text-sm text-nord-frostDark hover:underline"
        >
          Clear filters
        </Link>
      )}
    </div>
  );
}
