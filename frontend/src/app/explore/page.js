"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Heart, Play, X, TrendingUp } from "lucide-react";
import { gql } from "@/lib/graphql";
import { mediaSrc } from "@/lib/api";
import { useAuth } from "@/store/auth";
import Shell from "@/components/Shell";
import MediaRenderer from "@/components/MediaRenderer";

const EXPLORE_QUERY = `
  query Explore($userId: Int, $limit: Int) {
    explore(userId: $userId, limit: $limit) {
      id authorId authorUsername caption mediaUrl mediaType hashtags likeCount
    }
    trendingHashtags(limit: 10) { tag count }
  }
`;

export default function ExplorePage() {
  return (
    <Shell wide>
      <Explore />
    </Shell>
  );
}

function Explore() {
  const { user } = useAuth();
  const [selected, setSelected] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["explore", user?.id],
    queryFn: () => gql(EXPLORE_QUERY, { userId: user?.id, limit: 30 }),
    enabled: !!user,
  });

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <h1 className="text-2xl font-bold">Explore</h1>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">
          powered by GraphQL · Server 2
        </span>
      </div>

      {/* Trending hashtags */}
      {data?.trendingHashtags?.length > 0 && (
        <div className="card mb-6 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-soft">
            <TrendingUp size={16} /> Trending
          </p>
          <div className="flex flex-wrap gap-2">
            {data.trendingHashtags.map((h) => (
              <Link
                key={h.tag}
                href={`/explore/tag/${h.tag}`}
                className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                #{h.tag} <span className="text-ink-faint">{h.count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {isLoading && <p className="text-ink-faint">Discovering content…</p>}

      {/* Media grid */}
      <div className="grid grid-cols-3 gap-1 md:gap-2">
        {data?.explore?.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p)}
            className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100"
          >
            {p.mediaType === "video" ? (
              <>
                <video src={mediaSrc(p.mediaUrl)} className="h-full w-full object-cover" preload="metadata" />
                <Play size={28} className="absolute right-2 top-2 fill-white text-white drop-shadow" />
              </>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaSrc(p.mediaUrl)} alt="" className="h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
              <span className="flex items-center gap-1 font-bold text-white">
                <Heart size={20} className="fill-white" /> {p.likeCount}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox modal (uses GraphQL data directly — decoupled from Server 1) */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="card max-h-[90vh] w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <Link href={`/profile/${selected.authorUsername}`} className="font-semibold hover:underline">
                {selected.authorUsername}
              </Link>
              <button onClick={() => setSelected(null)}>
                <X size={20} />
              </button>
            </div>
            <MediaRenderer
              url={mediaSrc(selected.mediaUrl)}
              type={selected.mediaType}
              className="max-h-[60vh] object-contain bg-black"
            />
            <div className="px-4 py-3">
              <p className="flex items-center gap-1 font-semibold">
                <Heart size={16} className="fill-rose-500 text-rose-500" /> {selected.likeCount} likes
              </p>
              {selected.caption && <p className="mt-1 text-sm">{selected.caption}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
