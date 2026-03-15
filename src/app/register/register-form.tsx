"use client";

import { useActionState } from "react";
import { registerAction, type RegisterState } from "./actions";
import { Button, Input, ErrorMessage } from "@/components/ui";

const initialState: RegisterState | null = null;

type Props = {
  inviteToken: string;
  registerAction: typeof registerAction;
};

export function RegisterForm({ inviteToken, registerAction: action }: Props) {
  const [state, formAction] = useActionState(action, initialState);

  if (state?.success) {
    return (
      <ErrorMessage variant="success" title="Registration successful.">
        Your account is pending approval. You will be able to log in once an administrator approves your account.
        <a
          href="/login"
          className="mt-2 inline-block font-medium hover:underline"
        >
          Back to login
        </a>
      </ErrorMessage>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="inviteToken" value={inviteToken} readOnly />

      {state?.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <Input
        id="name"
        name="name"
        type="text"
        autoComplete="given-name"
        label="Name"
        placeholder="Your first name"
        required
      />

      <Input
        id="surname"
        name="surname"
        type="text"
        autoComplete="family-name"
        label="Surname"
        placeholder="Your surname"
        required
      />

      <Input
        id="username"
        name="username"
        type="text"
        autoComplete="username"
        label="Username"
        placeholder="3–32 characters, letters, numbers, underscore"
        minLength={3}
        maxLength={32}
        required
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
      />

      <Button type="submit" size="full">
        Register
      </Button>
    </form>
  );
}
