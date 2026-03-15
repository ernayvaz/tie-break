import Link from "next/link";
import { validateInviteToken } from "@/lib/invite";
import { registerAction } from "./actions";
import { RegisterForm } from "./register-form";

type Props = {
  searchParams: Promise<{ invite?: string }>;
};

export default async function RegisterPage({ searchParams }: Props) {
  const { invite } = await searchParams;
  const inviteToken = invite?.trim() ?? "";

  const validInvite = await validateInviteToken(inviteToken);
  if (!validInvite) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-nord-polar">Invalid invite link</h1>
            <p className="text-nord-polarLight text-sm mt-2">
              This invite link is invalid or has expired. Please use a valid link shared by the administrator.
            </p>
          </div>
          <Link
            href="/login"
            className="block text-center text-nord-frostDark font-medium hover:underline text-sm"
          >
            Back to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-nord-polar">Register</h1>
          <p className="text-nord-polarLight text-sm mt-1">
            Create your account. You will need admin approval before you can log in.
          </p>
        </div>

        <RegisterForm inviteToken={inviteToken} registerAction={registerAction} />

        <p className="text-center text-nord-polarLight text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-nord-frostDark font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
