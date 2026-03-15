"use client";

import { useState } from "react";
import { recalculateScoresAction } from "./actions";
import { Button, Spinner, ErrorMessage } from "@/components/ui";

export function RecalculateScoresButton() {
  const [state, setState] = useState<{
    message?: string;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    setState(null);
    try {
      const result = await recalculateScoresAction();
      setState(result ?? null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? (
          <>
            <Spinner size="sm" className="mr-2" />
            Recalculating…
          </>
        ) : (
          "Recalculate scores & leaderboard"
        )}
      </Button>
      {state?.message && (
        <p className="text-sm text-green-700">{state.message}</p>
      )}
      {state?.error && (
        <ErrorMessage variant="error">{state.error}</ErrorMessage>
      )}
    </div>
  );
}
