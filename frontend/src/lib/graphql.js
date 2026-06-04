// Minimal GraphQL client → gateway /graphql → Server 2.
// This is how the browser reaches the SECOND server (the GraphQL one).
import { API_URL } from "./api";

export async function gql(query, variables = {}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("fastgram_token") : null;

  const res = await fetch(`${API_URL}/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json.data;
}
