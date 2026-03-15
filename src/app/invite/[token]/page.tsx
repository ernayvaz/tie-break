import { redirect } from "next/navigation";
import Link from "next/link";
import { validateInviteToken } from "@/lib/invite";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const valid = await validateInviteToken(token);

  if (valid) {
    redirect(`/register?invite=${encodeURIComponent(token)}`);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-2xl font-semibold text-nord-polar">Invalid invite link</h1>
        <p className="text-nord-polarLight text-sm">
          This invite link is invalid or has expired. Please request a new link from the administrator.
        </p>
        <Link
          href="/login"
          className="inline-block text-nord-frostDark font-medium hover:underline text-sm"
        >
          Back to login
        </Link>
      </div>
    </main>
  );
}
