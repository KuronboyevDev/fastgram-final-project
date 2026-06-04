// Round avatar with a graceful fallback to the user's initial.
export default function Avatar({ src, name = "?", size = 40, ring = false }) {
  const dim = { width: size, height: size };
  const initial = (name || "?").charAt(0).toUpperCase();

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-gradient text-white ${
        ring ? "ring-2 ring-brand-400 ring-offset-2" : ""
      }`}
      style={dim}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      ) : (
        <span style={{ fontSize: size * 0.4 }} className="font-bold">
          {initial}
        </span>
      )}
    </div>
  );
}
