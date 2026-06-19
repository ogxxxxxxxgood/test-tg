/**
 * Formats a user as a Telegram mention (HTML mode)
 */
export function mention(
  userId: number,
  firstName: string,
  username?: string | null
): string {
  const name = escapeHtml(firstName || username || String(userId));
  return `<a href="tg://user?id=${userId}">${name}</a>`;
}

/**
 * Formats a user's display name with optional username
 */
export function displayName(
  firstName?: string | null,
  lastName?: string | null,
  username?: string | null,
  userId?: number
): string {
  const parts: string[] = [];
  if (firstName) parts.push(firstName);
  if (lastName) parts.push(lastName);
  const fullName = parts.join(" ") || username || String(userId ?? "Unknown");
  return username ? `${fullName} (@${username})` : fullName;
}

/**
 * Escapes HTML special characters for Telegram HTML parse mode
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
