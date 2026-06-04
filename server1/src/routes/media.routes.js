// Media serving + upload.
//
// 1) GET /uploads/:filename  — serves images normally and STREAMS videos using
//    HTTP Range requests so the browser can seek/scrub without downloading the
//    whole file. This is what makes <video> scrubbing work.
// 2) POST /api/upload         — generic single-file upload (used for avatars),
//    returns the relative media URL.
const express = require("express");
const fs = require("fs");
const path = require("path");
const { upload, UPLOAD_DIR } = require("../middleware/upload");
const { requireAuth } = require("../middleware/auth");
const { absoluteMediaUrl } = require("../lib/helpers");

const router = express.Router();

const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

// ── Stream / serve a media file ─────────────────────────────────────
function serveMedia(req, res) {
  const filename = path.basename(req.params.filename); // prevent path traversal
  const filePath = path.join(UPLOAD_DIR, filename);

  if (!fs.existsSync(filePath)) return res.status(404).end("Not found");

  const stat = fs.statSync(filePath);
  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";
  const range = req.headers.range;

  // Images (or no Range header): send the whole file.
  if (!range) {
    res.writeHead(200, {
      "Content-Length": stat.size,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    });
    return fs.createReadStream(filePath).pipe(res);
  }

  // Videos with a Range header: send just the requested byte range (206).
  const parts = range.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
  const chunkSize = end - start + 1;

  res.writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${stat.size}`,
    "Accept-Ranges": "bytes",
    "Content-Length": chunkSize,
    "Content-Type": contentType,
  });
  fs.createReadStream(filePath, { start, end }).pipe(res);
}

router.get("/uploads/:filename", serveMedia);

// ── Generic upload (e.g. avatar) ────────────────────────────────────
router.post("/api/upload", requireAuth, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const relative = `/uploads/${req.file.filename}`;
  res.status(201).json({ url: relative, absoluteUrl: absoluteMediaUrl(relative) });
});

module.exports = router;
