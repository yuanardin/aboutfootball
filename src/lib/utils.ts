import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { PlaceHolderImages } from "./placeholder-images";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getImageById(id?: string) {
  if (!id) return undefined;
  return PlaceHolderImages.find((img) => img.id === id);
}

export function formatMatchDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (match) {
    const [, year, month, day] = match;
    const utc = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return utc.toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  return date;
}
