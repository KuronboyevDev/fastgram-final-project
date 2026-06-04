"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import Avatar from "./Avatar";

// Modal that lists a user's followers OR the people they follow.
// `mode` is "followers" | "following"; `username` is whose list to load.
export default function UserListModal({ username, mode, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ["userlist", username, mode],
    queryFn: async () => (await api.get(`/api/users/${username}/${mode}`)).data,
  });

  const title = mode === "followers" ? "Followers" : "Following";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="card flex max-h-[70vh] w-full max-w-sm flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="font-bold">{title}</h3>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isLoading && <p className="p-4 text-center text-ink-faint">Loading…</p>}
          {data?.users?.length === 0 && (
            <p className="p-6 text-center text-ink-faint">
              {mode === "followers" ? "No followers yet." : "Not following anyone yet."}
            </p>
          )}
          {data?.users?.map((u) => (
            <Link
              key={u.id}
              href={`/profile/${u.username}`}
              onClick={onClose}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-100"
            >
              <Avatar src={u.avatarUrl} name={u.username} size={44} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{u.username}</p>
                <p className="truncate text-sm text-ink-faint">{u.fullName}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
