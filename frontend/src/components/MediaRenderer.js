// Renders a post's media: an <img> for images, a streaming <video> for videos.
// Videos use the browser's native controls; the server supports HTTP Range so
// scrubbing/seeking streams on demand instead of downloading the whole file.
export default function MediaRenderer({ url, type, className = "" }) {
  if (type === "video") {
    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className={`w-full bg-black ${className}`}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="post" className={`w-full object-cover ${className}`} />
  );
}
