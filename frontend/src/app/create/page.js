"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Film, X } from "lucide-react";
import { api } from "@/lib/api";
import Shell from "@/components/Shell";

export default function CreatePage() {
  return (
    <Shell>
      <CreatePost />
    </Shell>
  );
}

function CreatePost() {
  const router = useRouter();
  const fileRef = useRef();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isVideo, setIsVideo] = useState(false);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setIsVideo(f.type.startsWith("video"));
    setPreview(URL.createObjectURL(f));
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return setError("Please choose an image or video");
    setError("");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("media", file);
      fd.append("caption", caption);
      await api.post("/api/posts", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      router.push("/");
    } catch (err) {
      setError(err.response?.data?.error || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Create new post</h1>

      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-600">{error}</div>
      )}

      <form onSubmit={submit} className="card p-5">
        {!preview ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 text-ink-faint transition hover:border-brand-400 hover:bg-brand-50/40"
          >
            <div className="flex gap-3">
              <ImagePlus size={40} />
              <Film size={40} />
            </div>
            <span className="font-medium">Click to upload a photo or video</span>
            <span className="text-xs">JPG, PNG, GIF, MP4, WebM · up to 100MB</span>
          </button>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={reset}
              className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-1.5 text-white"
            >
              <X size={18} />
            </button>
            {isVideo ? (
              <video src={preview} controls className="max-h-[420px] w-full rounded-xl bg-black" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="preview" className="max-h-[420px] w-full rounded-xl object-contain bg-slate-100" />
            )}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          onChange={pick}
          className="hidden"
        />

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Write a caption… use #hashtags to be discoverable"
          rows={3}
          className="input mt-4 resize-none"
        />

        <button className="btn-brand mt-4 w-full" disabled={busy || !file}>
          {busy ? "Sharing…" : "Share post"}
        </button>
      </form>
    </div>
  );
}
