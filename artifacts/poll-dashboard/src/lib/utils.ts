import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRating(rating: number | undefined | null): string {
  if (rating === undefined || rating === null) return "0.00";
  return rating.toFixed(2);
}

export function formatNPS(nps: number | undefined | null): string {
  if (nps === undefined || nps === null) return "0%";
  return `${Math.round(nps)}%`;
}
