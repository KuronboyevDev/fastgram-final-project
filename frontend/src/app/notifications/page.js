"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MessageCircle, UserPlus, Mail } from "lucide-react";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/time";
import Shell from "@/components/Shell";
import Avatar from "@/components/Avatar";

const ICONS = {
  like: { Icon: Heart, color: "text-rose-500" },
  comment: { Icon: MessageCircle, color: "text-brand-600" },
  follow: { Icon: UserPlus, color: "text-emerald-500" },
  message: { Icon: Mail, color: "text-indigo-500" },
};

export default function NotificationsPage() {
  return (
    <Shell>
      <Notifications />
    </Shell>
  );
}

function Notifications() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get("/api/notifications")).data,
  });

  // Mark everything read when this page is viewed.
  useEffect(() => {
    api.post("/api/notifications/read").then(() => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });
  }, [queryClient]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Notifications</h1>
      {isLoading && <p className="text-ink-faint">Loading…</p>}
      {data?.notifications?.length === 0 && (
        <p className="text-ink-faint">Nothing here yet.</p>
      )}
      <div className="space-y-1">
        {data?.notifications?.map((n) => {
          const { Icon, color } = ICONS[n.type] || ICONS.like;
          return (
            <div
              key={n.id}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 ${
                n.read ? "" : "bg-brand-50/60"
              }`}
            >
              <Link href={`/profile/${n.actor.username}`}>
                <Avatar src={n.actor.avatarUrl} name={n.actor.username} size={42} />
              </Link>
              <div className="flex-1">
                <p className="text-sm">{n.text}</p>
                <p className="text-xs text-ink-faint">{timeAgo(n.createdAt)} ago</p>
              </div>
              <Icon size={20} className={`shrink-0 ${color}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
