import type { MuteDuration } from "../types";

/**
 * Parses a human-readable duration string into seconds.
 * Supported formats: 1s, 30m, 2h, 1d, 1w
 *
 * @param input - e.g. "1h", "30m", "2d"
 * @returns MuteDuration with seconds and a human-readable label, or null if invalid
 */
export function parseTime(input: string): MuteDuration | null {
  const match = input.trim().match(/^(\d+)(s|m|h|d|w)$/i);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
  };

  const unitLabels: Record<string, string> = {
    s: value === 1 ? "секунду" : value < 5 ? "секунды" : "секунд",
    m: value === 1 ? "минуту" : value < 5 ? "минуты" : "минут",
    h: value === 1 ? "час" : value < 5 ? "часа" : "часов",
    d: value === 1 ? "день" : value < 5 ? "дня" : "дней",
    w: value === 1 ? "неделю" : value < 5 ? "недели" : "недель",
  };

  const seconds = value * multipliers[unit];
  const label = `${value} ${unitLabels[unit]}`;

  return { seconds, label };
}

/**
 * Converts seconds to a Date in the future (for untilDate param)
 */
export function secondsFromNow(seconds: number): Date {
  return new Date(Date.now() + seconds * 1000);
}

/**
 * Formats a Date to a readable Russian locale string
 */
export function formatDate(date: Date): string {
  return date.toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Returns relative time in Russian
 */
export function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return `${diffSec} сек. назад`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} мин. назад`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ч. назад`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} дн. назад`;
  const diffMo = Math.floor(diffDay / 30);
  if (diffMo < 12) return `${diffMo} мес. назад`;
  return `${Math.floor(diffMo / 12)} г. назад`;
}
