"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, Grid3x3, BarChart3, MessageCircle, Camera } from "lucide-react";
import { api } from "@/lib/api";
import { gql } from "@/lib/graphql";
import { useAuth } from "@/store/auth";
import Shell from "@/components/Shell";
import Avatar from "@/components/Avatar";
import PostModal from "@/components/PostModal";
import UserListModal from "@/components/UserListModal";

const ANALYTICS_QUERY = `
  query Analytics($userId: Int!) {
    userAnalytics(userId: $userId) {
      postCount totalLikes followerCount followingCount
    }
  }
`;

export default function ProfilePage({ params }) {
  const { username } = params;
  return (
    <Shell wide>
      <Profile username={username} />
    </Shell>
  );
}

function Profile({ username }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: me, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const avatarInputRef = useRef();
  const [selectedPost, setSelectedPost] = useState(null); // post opened in modal
  const [listMode, setListMode] = useState(null); // "followers" | "following" | null

  const openEditor = (p) => {
    setBio(p.bio || "");
    setFullName(p.fullName || "");
    setAvatarFile(null);
    setAvatarPreview(null);
    setEditing(true);
  };

  const pickAvatar = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
  };

  const { data, isLoading } = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => (await api.get(`/api/users/${username}`)).data,
  });

  const profile = data?.user;

  // GraphQL analytics from Server 2 (totalLikes is computed there).
  const { data: analytics } = useQuery({
    queryKey: ["analytics", profile?.id],
    queryFn: () => gql(ANALYTICS_QUERY, { userId: profile.id }),
    enabled: !!profile?.id,
  });

  const follow = useMutation({
    mutationFn: async () => {
      if (profile.isFollowing) return api.delete(`/api/users/${profile.id}/follow`);
      return api.post(`/api/users/${profile.id}/follow`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile", username] }),
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      // 1) If a new avatar was chosen, upload the file first to get its URL.
      let avatarUrl;
      if (avatarFile) {
        const fd = new FormData();
        fd.append("file", avatarFile);
        const up = await api.post("/api/upload", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        avatarUrl = up.data.url;
      }
      // 2) Save profile fields (avatarUrl only included if it changed).
      const body = { bio, fullName, ...(avatarUrl !== undefined && { avatarUrl }) };
      return (await api.put("/api/users/me/profile", body)).data;
    },
    onSuccess: ({ user }) => {
      updateUser(user); // refresh the avatar shown in the sidebar immediately
      queryClient.invalidateQueries({ queryKey: ["profile", username] });
      setEditing(false);
    },
  });

  if (isLoading) return <p className="text-ink-faint">Loading profile…</p>;
  if (!profile) return <p>User not found.</p>;

  const stats = analytics?.userAnalytics;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-6 md:gap-10">
        <Avatar src={profile.avatarUrl} name={profile.username} size={96} ring />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold">{profile.username}</h1>
            {profile.isMe ? (
              <button
                onClick={() => openEditor(profile)}
                className="btn-ghost border border-slate-200 py-1.5"
              >
                Edit profile
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => follow.mutate()}
                  className={profile.isFollowing ? "btn-ghost border border-slate-200 py-1.5" : "btn-brand py-1.5"}
                >
                  {profile.isFollowing ? "Following" : "Follow"}
                </button>
                <button
                  onClick={() => router.push(`/messages/${profile.id}`)}
                  className="btn-ghost border border-slate-200 py-1.5"
                >
                  <MessageCircle size={18} /> Message
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-6 text-sm">
            <span><b>{profile.postCount}</b> posts</span>
            <button
              onClick={() => setListMode("followers")}
              className="transition hover:text-brand-600"
            >
              <b>{profile.followerCount}</b> followers
            </button>
            <button
              onClick={() => setListMode("following")}
              className="transition hover:text-brand-600"
            >
              <b>{profile.followingCount}</b> following
            </button>
          </div>

          <p className="mt-3 font-semibold">{profile.fullName}</p>
          <p className="text-ink-soft">{profile.bio}</p>
        </div>
      </div>

      {/* Analytics card (GraphQL · Server 2) */}
      {stats && (
        <div className="card mt-6 flex items-center justify-between p-4">
          <span className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
            <BarChart3 size={16} /> Analytics
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600">GraphQL</span>
          </span>
          <div className="flex gap-6 text-sm">
            <span><b>{stats.totalLikes}</b> total likes</span>
            <span><b>{stats.postCount}</b> posts</span>
          </div>
        </div>
      )}

      {/* Edit profile inline (avatar + name + bio) */}
      {editing && (
        <div className="card mt-4 p-4">
          {/* Avatar picker */}
          <div className="mb-4 flex items-center gap-4">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="group relative h-20 w-20 shrink-0"
              title="Change profile photo"
            >
              <Avatar
                src={avatarPreview || profile.avatarUrl}
                name={profile.username}
                size={80}
                ring
              />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition group-hover:opacity-100">
                <Camera size={22} className="text-white" />
              </span>
            </button>
            <div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="font-semibold text-brand-600 hover:underline"
              >
                Change profile photo
              </button>
              <p className="text-xs text-ink-faint">JPG, PNG, GIF or WebP</p>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={pickAvatar}
              className="hidden"
            />
          </div>

          <label className="mb-1 block text-sm font-medium">Name</label>
          <input
            className="input mb-3"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
          />

          <label className="mb-1 block text-sm font-medium">Bio</label>
          <textarea
            className="input resize-none"
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell people about yourself"
          />

          <div className="mt-3 flex gap-2">
            <button
              className="btn-brand py-1.5"
              onClick={() => saveProfile.mutate()}
              disabled={saveProfile.isPending}
            >
              {saveProfile.isPending ? "Saving…" : "Save"}
            </button>
            <button className="btn-ghost py-1.5" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Posts grid */}
      <div className="mt-8 mb-2 flex items-center justify-center gap-2 border-t border-slate-200 pt-4 text-sm font-semibold text-ink-soft">
        <Grid3x3 size={16} /> POSTS
      </div>
      {data.posts.length === 0 ? (
        <p className="py-10 text-center text-ink-faint">No posts yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-1 md:gap-2">
          {data.posts.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPost(p)}
              className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100"
            >
              {p.mediaType === "video" ? (
                <>
                  <video src={p.mediaUrl} className="h-full w-full object-cover" preload="metadata" />
                  <Play size={24} className="absolute right-2 top-2 fill-white text-white drop-shadow" />
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.mediaUrl} alt="" className="h-full w-full object-cover" />
              )}
              <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/15" />
            </button>
          ))}
        </div>
      )}

      {/* Post opened from the grid */}
      {selectedPost && (
        <PostModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onChanged={() => queryClient.invalidateQueries({ queryKey: ["profile", username] })}
        />
      )}

      {/* Followers / following list */}
      {listMode && (
        <UserListModal username={username} mode={listMode} onClose={() => setListMode(null)} />
      )}
    </div>
  );
}
