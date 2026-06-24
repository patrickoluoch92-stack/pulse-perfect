// Shared constants for the Kenya Hospitality Marketplace.

export const PROPERTY_CATEGORIES = [
  { value: "hotel", label: "Hotel" },
  { value: "resort", label: "Resort" },
  { value: "lodge", label: "Lodge" },
  { value: "camp", label: "Camp" },
  { value: "guest_house", label: "Guest House" },
  { value: "serviced_apartment", label: "Serviced Apartment" },
  { value: "airbnb", label: "Airbnb" },
  { value: "villa", label: "Villa" },
] as const;

export type PropertyCategory = (typeof PROPERTY_CATEGORIES)[number]["value"];

export const LISTING_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "archived", label: "Archived" },
] as const;

export type ListingStatus = (typeof LISTING_STATUSES)[number]["value"];

export const AVAILABILITY_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "limited", label: "Limited" },
  { value: "booked_out", label: "Booked out" },
] as const;

export const COMMON_AMENITIES = [
  "Wi-Fi",
  "Free parking",
  "Swimming pool",
  "Restaurant",
  "Bar",
  "Air conditioning",
  "Room service",
  "Spa",
  "Gym",
  "Airport shuttle",
  "Pet friendly",
  "Family rooms",
  "Beach access",
  "Game drives",
  "Conference facilities",
  "Laundry service",
] as const;

export const MARKETPLACE_BUCKET = "marketplace-properties";

export function categoryLabel(value: string): string {
  return PROPERTY_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function statusLabel(value: string): string {
  return LISTING_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
