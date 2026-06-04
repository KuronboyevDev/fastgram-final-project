"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Compass,
  MessageCircle,
  Bell,
  PlusSquare,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/store/auth";
import Avatar from "./Avatar";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/notifications", label: "Notifications", icon: Bell, badgeKey: true },
  { href: "/create", label: "Create", icon: PlusSquare },
];

export default function Sidebar({ unreadCount = 0 }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <aside className="sticky top-0 flex h-screen w-[76px] flex-col border-r border-slate-200 bg-white px-2 py-5 md:w-60 md:px-4">
      <Link href="/" className="mb-8 px-2">
        <span className="brand-text hidden text-2xl md:inline">FastGram</span>
        <span className="brand-text text-2xl md:hidden">F</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon, badgeKey }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`group relative flex items-center gap-4 rounded-xl px-3 py-3 transition hover:bg-slate-100 ${
                active ? "font-bold" : "font-medium text-ink-soft"
              }`}
            >
              <span className="relative">
                <Icon
                  size={24}
                  className={active ? "text-brand-600" : ""}
                  strokeWidth={active ? 2.5 : 2}
                />
                {badgeKey && unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              <span className="hidden md:inline">{label}</span>
            </Link>
          );
        })}

        {user && (
          <Link
            href={`/profile/${user.username}`}
            className={`flex items-center gap-4 rounded-xl px-3 py-3 transition hover:bg-slate-100 ${
              pathname?.startsWith("/profile") ? "font-bold" : "font-medium text-ink-soft"
            }`}
          >
            <Avatar src={user.avatarUrl} name={user.username} size={26} />
            <span className="hidden md:inline">Profile</span>
          </Link>
        )}
      </nav>

      <button onClick={handleLogout} className="btn-ghost mt-2 justify-start text-ink-soft">
        <LogOut size={22} />
        <span className="hidden md:inline">Log out</span>
      </button>
    </aside>
  );
}
