// ── FastGram seed script ────────────────────────────────────────────
// Populates fastgram_main with realistic fake data using Faker, downloads
// real images & sample videos into /uploads, then mirrors everything into
// Server 2 (so Explore/analytics work immediately).
//
// Run:  npm run seed
//
// Note: downloading media needs internet. If a download fails we fall back to
// storing the remote URL directly, so the seed never breaks.

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { faker } = require("@faker-js/faker");
const prisma = require("../src/lib/prisma");
const server2 = require("../src/lib/server2");
const { parseHashtags } = require("../src/lib/helpers");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const NUM_USERS = 12;
const POSTS_PER_USER = [2, 5]; // min,max
const PASSWORD = "password123";

// Public sample videos (small, reliable, CORS-friendly).
const VIDEO_SOURCES = [
  "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
  "https://www.w3schools.com/html/mov_bbb.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
];

const HASHTAG_POOL = [
  "travel", "food", "sunset", "nature", "photography", "art", "fitness",
  "coding", "music", "fashion", "coffee", "city", "beach", "mountains", "pets",
];

// Download a URL into /uploads and return the relative path. Falls back to the
// remote URL on failure (helpers.absoluteMediaUrl passes http URLs through).
async function downloadMedia(url, ext) {
  const name = faker.string.alphanumeric(20) + ext;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
    return `/uploads/${name}`;
  } catch (e) {
    console.warn(`   ⚠️  download failed (${url}) → using remote URL. ${e.message}`);
    return url; // fallback: store remote URL directly
  }
}

async function main() {
  console.log("🌱 Seeding FastGram...\n");

  // 1) Clean slate (respecting FK order).
  console.log("🧹 Clearing existing data...");
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.like.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();

  // 2) Pre-download a pool of media to reuse across posts.
  console.log("⬇️  Downloading media (images + videos)...");
  const imagePool = [];
  for (let i = 0; i < 16; i++) {
    const url = `https://picsum.photos/seed/fastgram${i}/800/800`;
    imagePool.push(await downloadMedia(url, ".jpg"));
  }
  let videoPool = [];
  for (const v of VIDEO_SOURCES) {
    videoPool.push(await downloadMedia(v, ".mp4"));
  }
  // Videos MUST be local — remote video hosts often 403 and won't play in the
  // browser. Drop any that fell back to a remote URL.
  videoPool = videoPool.filter((u) => u.startsWith("/uploads/"));
  const hasVideos = videoPool.length > 0;
  if (!hasVideos) {
    console.warn("   ⚠️  No videos downloaded — seeding image-only posts.");
  }
  console.log(`   ✓ ${imagePool.length} images, ${videoPool.length} videos ready\n`);

  const hash = await bcrypt.hash(PASSWORD, 10);

  // 3) Create users — a few fixed demo accounts + faker accounts.
  const demoNames = ["alice", "bob", "charlie", "diana"];
  const usernames = [...demoNames];
  while (usernames.length < NUM_USERS) {
    const u = faker.internet.username().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (u && !usernames.includes(u)) usernames.push(u);
  }

  console.log("👤 Creating users...");
  const users = [];
  for (let i = 0; i < usernames.length; i++) {
    const username = usernames[i];
    const avatar = await downloadMedia(
      `https://i.pravatar.cc/200?img=${(i % 70) + 1}`,
      ".jpg"
    );
    const user = await prisma.user.create({
      data: {
        username,
        email: `${username}@fastgram.dev`,
        password: hash,
        fullName: faker.person.fullName(),
        bio: faker.person.bio(),
        avatarUrl: avatar,
      },
    });
    users.push(user);
    await server2.syncUser(user); // microservice sync (awaited so seed is deterministic)
  }
  console.log(`   ✓ ${users.length} users (password for all: "${PASSWORD}")\n`);

  // 4) Posts.
  console.log("🖼️  Creating posts...");
  let postCount = 0;
  for (const user of users) {
    const n = faker.number.int({ min: POSTS_PER_USER[0], max: POSTS_PER_USER[1] });
    for (let i = 0; i < n; i++) {
      const isVideo = hasVideos && Math.random() < 0.25; // ~25% videos (if any)
      const mediaUrl = isVideo
        ? faker.helpers.arrayElement(videoPool)
        : faker.helpers.arrayElement(imagePool);
      const tags = faker.helpers.arrayElements(HASHTAG_POOL, { min: 1, max: 3 });
      const caption = `${faker.lorem.sentence()} ${tags.map((t) => "#" + t).join(" ")}`;

      const post = await prisma.post.create({
        data: {
          authorId: user.id,
          caption,
          mediaUrl,
          mediaType: isVideo ? "video" : "image",
          hashtags: parseHashtags(caption),
          createdAt: faker.date.recent({ days: 20 }),
        },
        include: { author: true },
      });
      await server2.indexPost(post); // microservice sync
      postCount++;
    }
  }
  console.log(`   ✓ ${postCount} posts\n`);

  // 5) Follows (random social graph).
  console.log("🔗 Creating follow graph...");
  let followCount = 0;
  for (const follower of users) {
    const targets = faker.helpers.arrayElements(
      users.filter((u) => u.id !== follower.id),
      { min: 2, max: 6 }
    );
    for (const target of targets) {
      try {
        await prisma.follow.create({
          data: { followerId: follower.id, followingId: target.id },
        });
        await server2.syncFollow(follower.id, target.id); // microservice sync
        followCount++;
      } catch {
        /* duplicate edge — ignore */
      }
    }
  }
  console.log(`   ✓ ${followCount} follow edges\n`);

  // 6) Likes & comments.
  console.log("❤️  Creating likes & comments...");
  const allPosts = await prisma.post.findMany();
  let likeCount = 0;
  let commentCount = 0;
  for (const post of allPosts) {
    const likers = faker.helpers.arrayElements(users, { min: 0, max: 8 });
    for (const liker of likers) {
      await prisma.like
        .create({ data: { postId: post.id, userId: liker.id } })
        .then(() => likeCount++)
        .catch(() => {});
    }
    const commenters = faker.helpers.arrayElements(users, { min: 0, max: 3 });
    for (const c of commenters) {
      await prisma.comment.create({
        data: { postId: post.id, authorId: c.id, text: faker.lorem.sentence() },
      });
      commentCount++;
    }
  }
  console.log(`   ✓ ${likeCount} likes, ${commentCount} comments\n`);

  // 7) A few DMs between demo users.
  console.log("💬 Creating sample messages...");
  const [alice, bob] = users;
  await prisma.message.createMany({
    data: [
      { senderId: alice.id, receiverId: bob.id, text: "Hey! Love your latest post 😍" },
      { senderId: bob.id, receiverId: alice.id, text: "Thanks! Shot it at sunset 🌅" },
      { senderId: alice.id, receiverId: bob.id, text: "We should collab sometime" },
    ],
  });
  console.log("   ✓ messages\n");

  console.log("✅ Seed complete!\n");
  console.log("   Demo logins (password = password123):");
  console.log("     alice / bob / charlie / diana\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    // Give fire-and-forget Server 2 sync calls a moment to flush.
    setTimeout(() => process.exit(0), 1500);
  });
