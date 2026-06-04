-- One-off data fix: repoint video posts (which had dead remote URLs) to the
-- locally-downloaded sample videos. Run against fastgram_main.
UPDATE "Post"
SET "mediaUrl" = CASE (id % 3)
  WHEN 0 THEN '/uploads/sample_bunny.mp4'
  WHEN 1 THEN '/uploads/sample_bbb.mp4'
  ELSE '/uploads/sample_flower.mp4'
END
WHERE "mediaType" = 'video';
