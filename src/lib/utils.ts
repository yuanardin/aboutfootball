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
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const time = new Date(date);
    return time.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  }
  return date;
}
