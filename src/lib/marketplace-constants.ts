// Shared constants for the Kenya Hospitality Marketplace.
//
// NOTE: This taxonomy is additive. Every previously-supported value is kept
// exactly as-is so existing listings, bookings, filters and API clients
// continue to work. New categories are appended.

export const PROPERTY_CATEGORIES = [
  // ----- Accommodation (original 8 preserved first for backward compat) -----
  { value: "hotel", label: "Hotel", group: "Accommodation" },
  { value: "resort", label: "Resort", group: "Accommodation" },
  { value: "lodge", label: "Lodge", group: "Accommodation" },
  { value: "camp", label: "Camp", group: "Nature & Wildlife" },
  { value: "guest_house", label: "Guest House", group: "Accommodation" },
  { value: "serviced_apartment", label: "Serviced Apartment", group: "Accommodation" },
  { value: "airbnb", label: "Airbnb", group: "Accommodation" },
  { value: "villa", label: "Villa", group: "Accommodation" },
  // ----- New accommodation types -----
  { value: "bnb", label: "Bed & Breakfast", group: "Accommodation" },
  { value: "boutique_hotel", label: "Boutique Hotel", group: "Accommodation" },
  { value: "holiday_home", label: "Holiday Home", group: "Accommodation" },
  { value: "hostel", label: "Hostel", group: "Accommodation" },
  // ----- Nature & Wildlife -----
  { value: "conservancy", label: "Conservancy", group: "Nature & Wildlife" },
  { value: "ranch", label: "Ranch", group: "Nature & Wildlife" },
  { value: "safari_camp", label: "Safari Camp", group: "Nature & Wildlife" },
  { value: "luxury_tented_camp", label: "Luxury Tented Camp", group: "Nature & Wildlife" },
  { value: "eco_lodge", label: "Eco-Lodge", group: "Nature & Wildlife" },
  { value: "campsite", label: "Campsite", group: "Nature & Wildlife" },
  { value: "glamping", label: "Glamping Site", group: "Nature & Wildlife" },
  { value: "mountain_lodge", label: "Mountain Lodge", group: "Nature & Wildlife" },
  { value: "beach_villa", label: "Beach Villa", group: "Nature & Wildlife" },
  { value: "lakefront_property", label: "Lakefront Property", group: "Nature & Wildlife" },
  { value: "forest_retreat", label: "Forest Retreat", group: "Nature & Wildlife" },
  // ----- Events & Retreats -----
  { value: "conference_centre", label: "Conference Centre", group: "Events & Retreats" },
  { value: "wedding_venue", label: "Wedding Venue", group: "Events & Retreats" },
  { value: "corporate_retreat", label: "Corporate Retreat", group: "Events & Retreats" },
  { value: "team_building_venue", label: "Team Building Venue", group: "Events & Retreats" },
  { value: "wellness_retreat", label: "Wellness Retreat", group: "Events & Retreats" },
  // ----- Residential rentals & sales -----
  { value: "bedsitter", label: "Bedsitter", group: "Residential" },
  { value: "single_room", label: "Single Room", group: "Residential" },
  { value: "studio", label: "Studio", group: "Residential" },
  { value: "one_bedroom", label: "1 Bedroom", group: "Residential" },
  { value: "two_bedroom", label: "2 Bedroom", group: "Residential" },
  { value: "three_bedroom", label: "3 Bedroom", group: "Residential" },
  { value: "four_bedroom", label: "4 Bedroom", group: "Residential" },
  { value: "apartment", label: "Apartment", group: "Residential" },
  { value: "flat", label: "Flat", group: "Residential" },
  { value: "maisonette", label: "Maisonette", group: "Residential" },
  { value: "townhouse", label: "Townhouse", group: "Residential" },
  { value: "standalone_house", label: "Stand-alone House", group: "Residential" },
  { value: "bungalow", label: "Bungalow", group: "Residential" },
  { value: "duplex", label: "Duplex", group: "Residential" },
  { value: "penthouse", label: "Penthouse", group: "Residential" },
  { value: "gated_community_home", label: "Gated Community Home", group: "Residential" },
  { value: "cottage", label: "Cottage", group: "Residential" },
  { value: "student_hostel", label: "Student Hostel", group: "Residential" },
  { value: "staff_housing", label: "Staff Housing", group: "Residential" },
  { value: "senior_living", label: "Senior Living", group: "Residential" },
  // ----- Commercial -----
  { value: "office_space", label: "Office Space", group: "Commercial" },
  { value: "shop", label: "Shop", group: "Commercial" },
  { value: "retail_space", label: "Retail Space", group: "Commercial" },
  { value: "warehouse", label: "Warehouse", group: "Commercial" },
  { value: "godown", label: "Godown", group: "Commercial" },
  { value: "industrial_building", label: "Industrial Building", group: "Commercial" },
  { value: "business_park", label: "Business Park", group: "Commercial" },
  { value: "coworking_space", label: "Coworking Space", group: "Commercial" },
  { value: "hotel_for_sale", label: "Hotel for Sale", group: "Commercial" },
  { value: "restaurant_lease", label: "Restaurant for Lease", group: "Commercial" },
  // ----- Agricultural -----
  { value: "farm", label: "Farm", group: "Agricultural" },
  { value: "agricultural_land", label: "Agricultural Land", group: "Agricultural" },
  { value: "tea_farm", label: "Tea Farm", group: "Agricultural" },
  { value: "coffee_farm", label: "Coffee Farm", group: "Agricultural" },
  { value: "flower_farm", label: "Flower Farm", group: "Agricultural" },
  { value: "dairy_farm", label: "Dairy Farm", group: "Agricultural" },
  { value: "poultry_farm", label: "Poultry Farm", group: "Agricultural" },
  { value: "fish_farm", label: "Fish Farm", group: "Agricultural" },
  // ----- Land plots -----
  { value: "residential_plot", label: "Residential Plot", group: "Land" },
  { value: "commercial_plot", label: "Commercial Plot", group: "Land" },
  { value: "industrial_plot", label: "Industrial Plot", group: "Land" },
  { value: "beach_plot", label: "Beach Plot", group: "Land" },
  { value: "lakefront_plot", label: "Lakefront Plot", group: "Land" },
  { value: "riverfront_plot", label: "Riverfront Plot", group: "Land" },
] as const;

export type PropertyCategory = (typeof PROPERTY_CATEGORIES)[number]["value"];

export const CATEGORY_GROUPS = [
  "Accommodation",
  "Nature & Wildlife",
  "Events & Retreats",
  "Residential",
  "Commercial",
  "Agricultural",
  "Land",
] as const;

// A listing's commercial intent. Existing hospitality listings default to short_stay.
export const LISTING_INTENTS = [
  { value: "short_stay", label: "Short stay / nightly" },
  { value: "rent", label: "For rent" },
  { value: "sale", label: "For sale" },
  { value: "lease", label: "For lease" },
] as const;
export type ListingIntent = (typeof LISTING_INTENTS)[number]["value"];

export const OCCUPANCY_STATUSES = [
  { value: "vacant", label: "Vacant" },
  { value: "occupied", label: "Occupied" },
  { value: "coming_soon", label: "Coming soon" },
  { value: "under_offer", label: "Under offer" },
] as const;


// Experiences / activities available AT a property (not property categories themselves).
export const ACTIVITIES = [
  "Wildlife safari",
  "Horse riding",
  "Bird watching",
  "Nature walks",
  "Hiking",
  "Camping",
  "Photography safari",
  "Cultural experience",
  "Farm tour",
  "Adventure activities",
  "Fishing",
  "Boat excursion",
  "Kayaking",
  "Diving / snorkelling",
  "Cycling",
  "Yoga & wellness",
] as const;

// Boolean-style attributes (used for filtering / faceting).
export const ATTRIBUTES = [
  { value: "beachfront", label: "Beachfront" },
  { value: "lakefront", label: "Lakefront" },
  { value: "forest", label: "Forest" },
  { value: "mountain", label: "Mountain" },
  { value: "family_friendly", label: "Family friendly" },
  { value: "pet_friendly", label: "Pet friendly" },
  { value: "luxury", label: "Luxury" },
  { value: "budget", label: "Budget" },
  { value: "eco_friendly", label: "Eco-friendly" },
  { value: "accessible", label: "Accessible" },
  { value: "romantic", label: "Romantic" },
] as const;

export type PropertyAttribute = (typeof ATTRIBUTES)[number]["value"];

export const BEST_SEASONS = [
  "Jan-Mar (Dry)",
  "Apr-May (Long rains)",
  "Jun-Sep (Cool dry)",
  "Oct-Nov (Short rains)",
  "Dec (Peak)",
] as const;

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

export function attributeLabel(value: string): string {
  return ATTRIBUTES.find((a) => a.value === value)?.label ?? value;
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
