// Zustand store for AUTH/client state (the current user + token).
// Zustand is our lightweight global client-state manager (vs TanStack Query
// which handles server state).
import { create } from "zustand";
import { api } from "@/lib/api";
import { disconnectSocket } from "@/lib/socket";

export const useAuth = create((set, get) => ({
  user: null,
  token: null,
  loading: true, // true until we've checked localStorage on first load

  // Called once on app start to restore a session from localStorage.
  init: async () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("fastgram_token");
    if (!token) {
      set({ loading: false });
      return;
    }
    set({ token });
    try {
      const { data } = await api.get("/api/auth/me");
      set({ user: data.user, loading: false });
    } catch {
      localStorage.removeItem("fastgram_token");
      set({ user: null, token: null, loading: false });
    }
  },

  login: async (username, password) => {
    const { data } = await api.post("/api/auth/login", { username, password });
    localStorage.setItem("fastgram_token", data.token);
    set({ user: data.user, token: data.token });
    return data.user;
  },

  register: async (payload) => {
    const { data } = await api.post("/api/auth/register", payload);
    localStorage.setItem("fastgram_token", data.token);
    set({ user: data.user, token: data.token });
    return data.user;
  },

  updateUser: (user) => set({ user }),

  logout: () => {
    localStorage.removeItem("fastgram_token");
    disconnectSocket();
    set({ user: null, token: null });
  },
}));
