"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { syncHighlightsAction } from "./actions";
import { Button, ErrorMessage, Spinner } from "@/components/ui";

export function SyncHighlightsButton() {
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
      const result = await syncHighlightsAction();
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
        variant="secondary"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? (
          <>
            <Spinner size="sm" className="mr-2" />
            Syncing…
          </>
        ) : (
          "Sync highlights (CL + World Cup)"
        )}
      </Button>
      {state?.message ? (
        <p className="text-sm text-green-700">{state.message}</p>
      ) : null}
      {state?.error ? (
        <ErrorMessage variant="error">{state.error}</ErrorMessage>
      ) : null}
    </div>
  );
}
