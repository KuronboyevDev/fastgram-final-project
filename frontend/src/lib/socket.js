// Socket.IO client singleton → gateway → Server 1 (real-time layer).
import { io } from "socket.io-client";
import { API_URL } from "./api";

let socket = null;

// Connect (or reuse) the socket, authenticating with the JWT.
export function getSocket() {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("fastgram_token");
  if (!token) return null;

  if (!socket) {
    socket = io(API_URL, {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
