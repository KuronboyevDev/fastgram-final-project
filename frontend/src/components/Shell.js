"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/store/auth";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import Sidebar from "./Sidebar";
import Avatar from "./Avatar";

// Wrap every authenticated page. Responsibilities:
//  • restore the session (auth init) and redirect to /login if signed out
//  • open the realtime socket once and keep it alive
//  • track unread notifications (REST + live socket events) for the nav badge
//  • show a small toast when a live notification/message arrives
export default function Shell({ children, wide = false }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [toast, setToast] = useState(null);

  // 1) Bootstrap auth exactly once.
  useEffect(() => {
    if (useAuth.getState().loading) useAuth.getState().init();
  }, []);

  // 2) Redirect out if not authenticated.
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Unread notification count for the sidebar badge.
  const { data: notifData } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get("/api/notifications")).data,
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const showToast = useCallback((text) => {
    setToast(text);
    setTimeout(() => setToast(null), 4000);
  }, []);

  // 3) Realtime: connect socket + listen for live events.
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    if (!socket) return;

    const onNotif = (n) => {
      showToast(`🔔 ${n.text}`);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };
    const onMessage = (m) => {
      showToast(`💬 ${m.sender?.username || "Someone"}: ${m.text}`);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["messages", m.senderId] });
    };

    socket.on("notification:new", onNotif);
    socket.on("message:new", onMessage);
    return () => {
      socket.off("notification:new", onNotif);
      socket.off("message:new", onMessage);
    };
  }, [user, queryClient, showToast]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="brand-text animate-pulse text-3xl">FastGram</div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl">
      <Sidebar unreadCount={notifData?.unreadCount || 0} />
      <main className={`flex-1 ${wide ? "" : "max-w-2xl"} px-4 py-6 md:px-8`}>
        {children}
      </main>

      {/* Live toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-in rounded-2xl bg-ink px-5 py-3 text-sm font-medium text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
