// Small shared helpers used across routes.

// Extract #hashtags from a caption -> ["sunset", "travel"]
function parseHashtags(text = "") {
  const matches = text.match(/#(\w+)/g) || [];
  return [...new Set(matches.map((h) => h.slice(1).toLowerCase()))];
}

// Turn a stored relative media path into an absolute URL the browser can load.
// Media is served through the gateway (PUBLIC_MEDIA_BASE), e.g.
//   /uploads/abc.jpg  ->  http://localhost:8080/uploads/abc.jpg
function absoluteMediaUrl(relativePath) {
  if (!relativePath) return "";
  if (/^https?:\/\//.test(relativePath)) return relativePath; // already absolute
  const base = process.env.PUBLIC_MEDIA_BASE || "http://localhost:8080";
  return base.replace(/\/$/, "") + relativePath;
}

// Shape a Prisma user record into a safe public object (never leak password).
function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    bio: u.bio,
    avatarUrl: absoluteMediaUrl(u.avatarUrl),
    createdAt: u.createdAt,
  };
}

// Shape a Prisma post (with _count + likes for the current user) into API JSON.
function publicPost(p, currentUserId) {
  return {
    id: p.id,
    caption: p.caption,
    mediaUrl: absoluteMediaUrl(p.mediaUrl),
    mediaType: p.mediaType,
    hashtags: p.hashtags || [],
    createdAt: p.createdAt,
    author: publicUser(p.author),
    likeCount: p._count ? p._count.likes : 0,
    commentCount: p._count ? p._count.comments : 0,
    likedByMe: Array.isArray(p.likes)
      ? p.likes.some((l) => l.userId === currentUserId)
      : false,
  };
}

module.exports = { parseHashtags, absoluteMediaUrl, publicUser, publicPost };
