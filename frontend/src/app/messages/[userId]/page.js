"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Send } from "lucide-react";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useAuth } from "@/store/auth";
import Shell from "@/components/Shell";
import Avatar from "@/components/Avatar";

export default function ChatPage({ params }) {
  const { userId } = params;
  return (
    <Shell>
      <Chat partnerId={Number(userId)} />
    </Shell>
  );
}

function Chat({ partnerId }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [partnerTyping, setPartnerTyping] = useState(false);
  const bottomRef = useRef();
  const typingTimeout = useRef();

  const { data } = useQuery({
    queryKey: ["messages", partnerId],
    queryFn: async () => (await api.get(`/api/messages/${partnerId}`)).data,
  });

  // Seed local message list from history.
  useEffect(() => {
    if (data?.messages) setMessages(data.messages);
  }, [data]);

  // Live: append messages arriving from the partner; show typing indicator.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNew = (m) => {
      if (m.senderId === partnerId) {
        setMessages((prev) => [...prev, m]);
        setPartnerTyping(false);
      }
    };
    const onTyping = ({ from }) => {
      if (from === partnerId) {
        setPartnerTyping(true);
        clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setPartnerTyping(false), 1500);
      }
    };

    socket.on("message:new", onNew);
    socket.on("message:typing", onTyping);
    return () => {
      socket.off("message:new", onNew);
      socket.off("message:typing", onTyping);
    };
  }, [partnerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, partnerTyping]);

  const send = (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    const socket = getSocket();
    socket.emit("message:send", { toUserId: partnerId, text: body }, (res) => {
      if (res?.ok) setMessages((prev) => [...prev, res.message]);
    });
    setText("");
  };

  const onType = (e) => {
    setText(e.target.value);
    getSocket()?.emit("message:typing", { toUserId: partnerId });
  };

  const partner = data?.partner;

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
        <Link href="/messages" className="md:hidden">
          <ArrowLeft size={22} />
        </Link>
        {partner && (
          <Link href={`/profile/${partner.username}`} className="flex items-center gap-3">
            <Avatar src={partner.avatarUrl} name={partner.username} size={40} />
            <span className="font-semibold">{partner.username}</span>
          </Link>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto py-4">
        {messages.map((m) => {
          const mine = m.senderId === user.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                  mine ? "bg-brand-500 text-white" : "bg-slate-100 text-ink"
                }`}
              >
                {m.text}
              </div>
            </div>
          );
        })}
        {partnerTyping && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-slate-100 px-4 py-2 text-ink-faint">typing…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form onSubmit={send} className="flex items-center gap-2 border-t border-slate-200 pt-3">
        <input value={text} onChange={onType} placeholder="Message…" className="input" />
        <button type="submit" className="btn-brand px-4" disabled={!text.trim()}>
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
