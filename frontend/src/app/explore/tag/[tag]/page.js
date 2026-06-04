"use client";

import { useQuery } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { gql } from "@/lib/graphql";
import { mediaSrc } from "@/lib/api";
import Shell from "@/components/Shell";

const TAG_QUERY = `
  query Tag($tag: String!) {
    postsByHashtag(tag: $tag) {
      id authorUsername caption mediaUrl mediaType likeCount
    }
  }
`;

export default function TagPage({ params }) {
  const { tag } = params;
  return (
    <Shell wide>
      <TagFeed tag={tag} />
    </Shell>
  );
}

function TagFeed({ tag }) {
  const { data, isLoading } = useQuery({
    queryKey: ["tag", tag],
    queryFn: () => gql(TAG_QUERY, { tag }),
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-brand-700">#{tag}</h1>
      <p className="mb-6 text-sm text-ink-faint">
        {data?.postsByHashtag?.length || 0} posts · via GraphQL (Server 2)
      </p>

      {isLoading && <p className="text-ink-faint">Loading…</p>}

      <div className="grid grid-cols-3 gap-1 md:gap-2">
        {data?.postsByHashtag?.map((p) => (
          <div key={p.id} className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
            {p.mediaType === "video" ? (
              <>
                <video src={mediaSrc(p.mediaUrl)} className="h-full w-full object-cover" preload="metadata" />
                <Play size={24} className="absolute right-2 top-2 fill-white text-white drop-shadow" />
              </>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaSrc(p.mediaUrl)} alt="" className="h-full w-full object-cover" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
