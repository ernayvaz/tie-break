"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { syncMatchesAction } from "./actions";
import { Button, Spinner, ErrorMessage } from "@/components/ui";

export function SyncMatchesButton() {
  const router = useRouter();
  const [state, setState] = useState<{
    message?: string;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    setState(null);
    try {
      const result = await syncMatchesAction();
      setState(result ?? null);
      if (result?.message) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="success"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? (
          <>
            <Spinner size="sm" className="mr-2" />
            Syncing…
          </>
        ) : (
          "Sync matches from API"
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
