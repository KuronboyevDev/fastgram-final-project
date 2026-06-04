"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, MessageCircle, Trash2, Send } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { timeAgo } from "@/lib/time";
import Avatar from "./Avatar";
import MediaRenderer from "./MediaRenderer";

export default function PostCard({ post, onChanged }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(null);
  const [commentText, setCommentText] = useState("");

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (liked) return api.delete(`/api/posts/${post.id}/like`);
      return api.post(`/api/posts/${post.id}/like`);
    },
    onMutate: () => {
      setLiked((v) => !v);
      setLikeCount((c) => c + (liked ? -1 : 1));
    },
    onError: () => {
      setLiked((v) => !v);
      setLikeCount((c) => c + (liked ? 1 : -1));
    },
  });

  const loadComments = async () => {
    setShowComments((s) => !s);
    if (comments === null) {
      const { data } = await api.get(`/api/posts/${post.id}/comments`);
      setComments(data.comments);
    }
  };

  const addComment = useMutation({
    mutationFn: async () =>
      (await api.post(`/api/posts/${post.id}/comments`, { text: commentText })).data,
    onSuccess: ({ comment }) => {
      setComments((c) => [...(c || []), comment]);
      setCommentText("");
    },
  });

  const deletePost = useMutation({
    mutationFn: async () => api.delete(`/api/posts/${post.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      onChanged?.();
    },
  });

  return (
    <article className="card mb-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Link href={`/profile/${post.author.username}`}>
          <Avatar src={post.author.avatarUrl} name={post.author.username} size={38} ring />
        </Link>
        <div className="flex-1">
          <Link
            href={`/profile/${post.author.username}`}
            className="font-semibold hover:underline"
          >
            {post.author.username}
          </Link>
          <p className="text-xs text-ink-faint">{timeAgo(post.createdAt)} ago</p>
        </div>
        {user?.id === post.author.id && (
          <button
            onClick={() => deletePost.mutate()}
            className="text-ink-faint transition hover:text-rose-500"
            title="Delete post"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {/* Media */}
      <MediaRenderer
        url={post.mediaUrl}
        type={post.mediaType}
        className="max-h-[640px] object-contain bg-slate-100"
      />

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 pt-3">
        <button
          onClick={() => toggleLike.mutate()}
          className="transition active:scale-90"
          aria-label="like"
        >
          <Heart
            size={26}
            className={liked ? "fill-rose-500 text-rose-500" : "text-ink"}
          />
        </button>
        <button onClick={loadComments} className="transition active:scale-90">
          <MessageCircle size={26} />
        </button>
      </div>

      {/* Likes + caption */}
      <div className="px-4 py-2">
        <p className="font-semibold">{likeCount} likes</p>
        {post.caption && (
          <p className="mt-1">
            <Link
              href={`/profile/${post.author.username}`}
              className="font-semibold hover:underline"
            >
              {post.author.username}
            </Link>{" "}
            {renderCaption(post.caption)}
          </p>
        )}
        {post.commentCount > 0 && !showComments && (
          <button onClick={loadComments} className="mt-1 text-sm text-ink-faint">
            View all {post.commentCount} comments
          </button>
        )}
      </div>

      {/* Comments */}
      {showComments && (
        <div className="border-t border-slate-100 px-4 py-3">
          <div className="mb-3 max-h-56 space-y-2 overflow-y-auto">
            {comments === null && <p className="text-sm text-ink-faint">Loading…</p>}
            {comments?.length === 0 && (
              <p className="text-sm text-ink-faint">No comments yet. Say hi 👋</p>
            )}
            {comments?.map((c) => (
              <p key={c.id} className="text-sm">
                <Link
                  href={`/profile/${c.author.username}`}
                  className="font-semibold hover:underline"
                >
                  {c.author.username}
                </Link>{" "}
                {c.text}
              </p>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (commentText.trim()) addComment.mutate();
            }}
            className="flex items-center gap-2"
          >
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment…"
              className="input py-2"
            />
            <button type="submit" className="btn-brand px-3" disabled={!commentText.trim()}>
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

// Linkify #hashtags inside captions → /explore/tag/<tag>
function renderCaption(caption) {
  return caption.split(/(\s+)/).map((word, i) => {
    if (word.startsWith("#")) {
      const tag = word.slice(1).replace(/[^\w]/g, "");
      return (
        <Link key={i} href={`/explore/tag/${tag}`} className="text-brand-600 hover:underline">
          {word}
        </Link>
      );
    }
    return word;
  });
}
