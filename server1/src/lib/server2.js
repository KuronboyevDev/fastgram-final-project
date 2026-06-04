// Microservice client: Server 1 → Server 2 (the GraphQL/analytics service).
//
// Whenever core data changes on Server 1 (a new post, a new follow), we push a
// small event to Server 2's INTERNAL REST endpoints so it can keep its own
// content-discovery / analytics tables in sync. These calls are "fire and
// forget" — if Server 2 is down, Server 1 keeps working and just logs a warning.
//
// This is the "Add micro service communication" arrow in the architecture diagram.

const axios = require("axios");

const BASE = process.env.SERVER2_INTERNAL_URL || "http://localhost:8000";

const http = axios.create({ baseURL: BASE, timeout: 4000 });

async function safePost(path, body) {
  try {
    await http.post(path, body);
  } catch (err) {
    console.warn(
      `⚠️  Server2 sync failed (${path}): ${err.message}. ` +
        `Server 1 continues normally.`
    );
  }
}

// Tell Server 2 about a brand-new post so it can be indexed for Explore.
function indexPost(post) {
  return safePost("/internal/posts", {
    id: post.id,
    author_id: post.authorId,
    author_username: post.author?.username,
    caption: post.caption,
    media_url: post.mediaUrl,
    media_type: post.mediaType,
    hashtags: post.hashtags || [],
    created_at: post.createdAt,
  });
}

// Tell Server 2 about a follow edge so Explore can prioritise the user's network.
function syncFollow(followerId, followingId) {
  return safePost("/internal/follows", {
    follower_id: followerId,
    following_id: followingId,
  });
}

// Mirror a user into Server 2 (used by the seed and on registration).
function syncUser(user) {
  return safePost("/internal/users", {
    id: user.id,
    username: user.username,
    full_name: user.fullName,
    avatar_url: user.avatarUrl,
  });
}

module.exports = { indexPost, syncFollow, syncUser };
