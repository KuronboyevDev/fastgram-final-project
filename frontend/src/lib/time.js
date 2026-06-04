import { formatDistanceToNowStrict } from "date-fns";

// "3h", "2d" style relative time.
export function timeAgo(date) {
  try {
    return formatDistanceToNowStrict(new Date(date), { addSuffix: false })
      .replace(" seconds", "s")
      .replace(" second", "s")
      .replace(" minutes", "m")
      .replace(" minute", "m")
      .replace(" hours", "h")
      .replace(" hour", "h")
      .replace(" days", "d")
      .replace(" day", "d")
      .replace(/\s/g, "");
  } catch {
    return "";
  }
}
