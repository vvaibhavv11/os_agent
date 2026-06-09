export function formatTitle(title: string, maxLen = 28): string {
  if (title.length <= maxLen) return title;
  return title.slice(0, maxLen) + "...";
}

export function formatTime(_iso: string): string {
  return "";
}
