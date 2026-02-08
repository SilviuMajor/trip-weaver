export interface CategoryDef {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

/**
 * Predefined categories with default colours and emojis.
 * Travel-mode categories are separate entries so they appear in the picker.
 */
export const PREDEFINED_CATEGORIES: CategoryDef[] = [
  { id: 'flight',      name: 'Flight',      emoji: '✈️',  color: 'hsl(210, 70%, 50%)' },
  { id: 'travel',      name: 'Travel',      emoji: '🚌',  color: 'hsl(200, 60%, 45%)' },
  { id: 'breakfast',   name: 'Breakfast',   emoji: '☕',  color: 'hsl(35, 80%, 50%)' },
  { id: 'lunch',       name: 'Lunch',       emoji: '🍽️', color: 'hsl(24, 85%, 55%)' },
  { id: 'dinner',      name: 'Dinner',      emoji: '🥘',  color: 'hsl(340, 65%, 50%)' },
  { id: 'drinks',      name: 'Drinks',      emoji: '🍸',  color: 'hsl(280, 60%, 50%)' },
  { id: 'hotel',       name: 'Hotel',       emoji: '🏨',  color: 'hsl(260, 50%, 55%)' },
  { id: 'home',        name: 'Home',        emoji: '🏠',  color: 'hsl(160, 50%, 45%)' },
  { id: 'activity',    name: 'Activity',    emoji: '🎭',  color: 'hsl(170, 60%, 45%)' },
  { id: 'sightseeing', name: 'Sightseeing', emoji: '🏛️', color: 'hsl(45, 80%, 50%)' },
  { id: 'shopping',    name: 'Shopping',    emoji: '🛍️', color: 'hsl(320, 60%, 50%)' },
];

export const TRAVEL_MODES = [
  { id: 'walk',      label: 'Walk',             emoji: '🚶' },
  { id: 'transit',   label: 'Public Transport', emoji: '🚌' },
  { id: 'cycle',     label: 'Cycle',            emoji: '🚲' },
  { id: 'drive',     label: 'Drive',            emoji: '🚗' },
];

/** Look up a predefined category by its id */
export const findCategory = (id: string | null): CategoryDef | undefined =>
  id ? PREDEFINED_CATEGORIES.find(c => c.id === id) : undefined;

/** Get the display label for a category: "emoji Name" */
export const categoryLabel = (id: string | null, customName?: string | null): string => {
  const cat = findCategory(id ?? '');
  if (cat) return `${cat.emoji} ${cat.name}`;
  return customName ?? '';
};

/** Get the colour for a category (predefined or custom fallback) */
export const categoryColor = (id: string | null, customColor?: string | null): string => {
  const cat = findCategory(id ?? '');
  if (cat) return cat.color;
  return customColor ?? 'hsl(240, 40%, 55%)';
};
