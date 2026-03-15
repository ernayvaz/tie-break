"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";
import { Button, Input, ErrorMessage } from "@/components/ui";

const initialState: LoginState | null = null;

export function LoginForm({
  loginAction: action,
}: {
  loginAction: typeof loginAction;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5">
      {state?.statusMessage === "pending" && (
        <ErrorMessage variant="warning" title="Pending approval.">
          Your account is waiting for admin approval. You cannot sign in until then.
        </ErrorMessage>
      )}
      {state?.statusMessage === "rejected" && (
        <ErrorMessage variant="error" title="Account rejected.">
          Your registration was not approved. Contact the administrator if you think this is an error.
        </ErrorMessage>
      )}
      {state?.statusMessage === "blocked" && (
        <ErrorMessage variant="error" title="Account blocked.">
          Your account has been blocked. Contact the administrator for details.
        </ErrorMessage>
      )}
      {state?.error && !state?.statusMessage && (
        <ErrorMessage>{state.error}</ErrorMessage>
      )}

      <Input
        id="username"
        name="username"
        type="text"
        autoComplete="username"
        label="Username"
        placeholder="Your username"
        required
        className="border-nord-polarLighter/50 focus:ring-nord-frostDark/20"
      />

      <Input
        id="pin"
        name="pin"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        label="PIN (4 digits)"
        placeholder="••••"
        required
        className="border-nord-polarLighter/50 focus:ring-nord-frostDark/20"
      />

      <Button type="submit" size="full" className="mt-6">
        Sign in
      </Button>
    </form>
  );
}
