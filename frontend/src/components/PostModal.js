"use client";

import { X } from "lucide-react";
import PostCard from "./PostCard";

// Opens a single post in a centered modal, reusing PostCard so likes and
// comments work exactly like in the feed. `post` is the full post object.
export default function PostModal({ post, onClose, onChanged }) {
  if (!post) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 py-10"
      onClick={onClose}
    >
      <div className="relative w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-8 right-0 text-white/90 hover:text-white"
          aria-label="Close"
        >
          <X size={26} />
        </button>
        <PostCard
          post={post}
          onChanged={() => {
            onChanged?.();
            onClose();
          }}
        />
      </div>
    </div>
  );
}
