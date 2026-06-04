// Axios instance pointed at the GATEWAY. Every REST call (Server 1) goes here.
// The browser never talks to Server 1 / Server 2 directly — only the gateway.
import axios from "axios";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export const api = axios.create({ baseURL: API_URL });

// Turn a possibly-relative media path (e.g. "/uploads/x.jpg" coming from the
// GraphQL service) into a full URL the browser can load via the gateway.
export function mediaSrc(url) {
  if (!url) return "";
  if (/^https?:\/\//.test(url)) return url;
  return `${API_URL}${url}`;
}

// Attach the JWT from localStorage to every request automatically.
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("fastgram_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear the token so the app bounces back to login.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("fastgram_token");
    }
    return Promise.reject(err);
  }
);
