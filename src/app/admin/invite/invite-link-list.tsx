"use client";

import { useState } from "react";
import { Card, CardContent, Button, Input } from "@/components/ui";

type LinkItem = {
  id: string;
  token: string;
  fullUrl: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
};

export function InviteLinkList({ links }: { links: LinkItem[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      const el = document.getElementById(`url-${id}`);
      if (el instanceof HTMLInputElement) el.select();
    }
  };

  if (links.length === 0) {
    return (
      <Card className="mt-6 bg-nord-snow/50">
        <CardContent className="py-6 text-center text-sm text-nord-polarLight">
          No invite links yet. Run <code className="rounded bg-white px-1 py-0.5">npm run db:seed</code> to create one.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {links.map((link) => (
        <Card key={link.id}>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id={`url-${link.id}`}
                type="text"
                readOnly
                value={link.fullUrl}
                className="min-w-0 flex-1 bg-nord-snow/50 text-sm"
              />
              <Button
                type="button"
                onClick={() => copyToClipboard(link.fullUrl, link.id)}
              >
                {copiedId === link.id ? "Copied" : "Copy link"}
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-nord-polarLight">
              <span>{link.isActive ? "Active" : "Inactive"}</span>
              {link.expiresAt && (
                <span>Expires {new Date(link.expiresAt).toLocaleDateString()}</span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
