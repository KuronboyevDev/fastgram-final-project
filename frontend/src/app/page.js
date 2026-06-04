"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import Shell from "@/components/Shell";
import PostCard from "@/components/PostCard";
import Avatar from "@/components/Avatar";

export default function HomePage() {
  return (
    <Shell>
      <Feed />
    </Shell>
  );
}

function Feed() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["feed"],
    queryFn: async () => (await api.get("/api/feed")).data,
  });

  const { data: sugg } = useQuery({
    queryKey: ["suggestions"],
    queryFn: async () => (await api.get("/api/users/suggestions")).data,
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="brand-text text-2xl md:hidden">FastGram</h1>
        {data?.cached && (
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            ⚡ served from Redis cache
          </span>
        )}
      </div>

      {/* Suggestions strip */}
      {sugg?.users?.length > 0 && (
        <div className="card mb-6 p-4">
          <p className="mb-3 text-sm font-semibold text-ink-soft">Suggested for you</p>
          <div className="flex gap-4 overflow-x-auto">
            {sugg.users.map((u) => (
              <Link
                key={u.id}
                href={`/profile/${u.username}`}
                className="flex w-20 shrink-0 flex-col items-center gap-1 text-center"
              >
                <Avatar src={u.avatarUrl} name={u.username} size={56} ring />
                <span className="truncate text-xs font-medium">{u.username}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {isLoading && <p className="text-ink-faint">Loading your feed…</p>}

      {data?.posts?.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-lg font-semibold">Your feed is quiet 🤫</p>
          <p className="mt-1 text-ink-soft">
            Follow people from{" "}
            <Link href="/explore" className="font-semibold text-brand-600">
              Explore
            </Link>{" "}
            to see their posts here.
          </p>
        </div>
      )}

      {data?.posts?.map((post) => (
        <PostCard key={post.id} post={post} onChanged={refetch} />
      ))}
    </div>
  );
}
