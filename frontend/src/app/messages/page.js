"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/time";
import Shell from "@/components/Shell";
import Avatar from "@/components/Avatar";

export default function MessagesPage() {
  return (
    <Shell>
      <Conversations />
    </Shell>
  );
}

function Conversations() {
  const { data, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => (await api.get("/api/messages")).data,
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Messages</h1>
      {isLoading && <p className="text-ink-faint">Loading…</p>}
      {data?.conversations?.length === 0 && (
        <p className="text-ink-faint">
          No conversations yet. Visit a profile and tap “Message”.
        </p>
      )}
      <div className="space-y-1">
        {data?.conversations?.map((c) => (
          <Link
            key={c.partner.id}
            href={`/messages/${c.partner.id}`}
            className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-slate-100"
          >
            <Avatar src={c.partner.avatarUrl} name={c.partner.username} size={48} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{c.partner.username}</p>
              <p className="truncate text-sm text-ink-faint">{c.lastMessage}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-ink-faint">{timeAgo(c.lastAt)}</span>
              {c.unread && <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
