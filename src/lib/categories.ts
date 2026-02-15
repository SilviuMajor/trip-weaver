export interface CategoryDef {
  id: string;
  name: string;
  emoji: string;
  color: string;
  defaultDurationMin: number;
  defaultStartHour: number;
  defaultStartMin: number;
  /** If false, this category is system-only and hidden from the picker */
  pickerVisible?: boolean;
}

/**
 * Predefined categories with default colours and emojis.
 * Categories with pickerVisible: false are system-only (render correctly but hidden from picker).
 */
export const PREDEFINED_CATEGORIES: CategoryDef[] = [
  // === Picker-visible categories (shown to users) ===
  { id: 'flight',           name: 'Flight',           emoji: '✈️',  color: 'hsl(210, 70%, 50%)', defaultDurationMin: 180, defaultStartHour: 10, defaultStartMin: 0, pickerVisible: true },
  { id: 'hotel',            name: 'Hotel',            emoji: '🏨',  color: 'hsl(260, 50%, 55%)', defaultDurationMin: 600, defaultStartHour: 22, defaultStartMin: 0, pickerVisible: true },
  { id: 'breakfast',        name: 'Breakfast',        emoji: '🍳',  color: 'hsl(35, 80%, 50%)',  defaultDurationMin: 60,  defaultStartHour: 8,  defaultStartMin: 0, pickerVisible: true },
  { id: 'lunch',            name: 'Lunch',            emoji: '🍽️', color: 'hsl(24, 85%, 55%)',  defaultDurationMin: 90,  defaultStartHour: 12, defaultStartMin: 30, pickerVisible: true },
  { id: 'dinner',           name: 'Dinner',           emoji: '🍲',  color: 'hsl(340, 65%, 50%)', defaultDurationMin: 120, defaultStartHour: 19, defaultStartMin: 0, pickerVisible: true },
  { id: 'drinks',           name: 'Drinks',           emoji: '🍸',  color: 'hsl(280, 60%, 50%)', defaultDurationMin: 120, defaultStartHour: 21, defaultStartMin: 0, pickerVisible: true },
  { id: 'nightlife',        name: 'Nightlife',        emoji: '🎉',  color: 'hsl(300, 70%, 45%)', defaultDurationMin: 180, defaultStartHour: 22, defaultStartMin: 0, pickerVisible: true },
  { id: 'coffee_shop',      name: 'Coffee Shop',      emoji: '☕',  color: 'hsl(25, 70%, 45%)',  defaultDurationMin: 45,  defaultStartHour: 10, defaultStartMin: 0, pickerVisible: true },
  { id: 'museum',           name: 'Museum / Gallery', emoji: '🖼️', color: 'hsl(15, 60%, 50%)',  defaultDurationMin: 120, defaultStartHour: 11, defaultStartMin: 0, pickerVisible: true },
  { id: 'activity',         name: 'Activity',         emoji: '🎭',  color: 'hsl(170, 60%, 45%)', defaultDurationMin: 120, defaultStartHour: 10, defaultStartMin: 0, pickerVisible: true },
  { id: 'sightseeing',      name: 'Sightseeing',      emoji: '🏛️', color: 'hsl(45, 80%, 50%)',  defaultDurationMin: 120, defaultStartHour: 14, defaultStartMin: 0, pickerVisible: true },
  { id: 'shopping',         name: 'Shopping',         emoji: '🛍️', color: 'hsl(320, 60%, 50%)', defaultDurationMin: 90,  defaultStartHour: 15, defaultStartMin: 0, pickerVisible: true },
  { id: 'park',             name: 'Park',             emoji: '🌳',  color: 'hsl(140, 55%, 42%)', defaultDurationMin: 90,  defaultStartHour: 14, defaultStartMin: 0, pickerVisible: true },
  { id: 'private_transfer', name: 'Private Transfer', emoji: '🚐',  color: 'hsl(220, 50%, 50%)', defaultDurationMin: 45,  defaultStartHour: 9,  defaultStartMin: 0, pickerVisible: true },

  // === System-only categories (render correctly but hidden from picker) ===
  { id: 'transfer',           name: 'Transfer',    emoji: '🚐',  color: 'hsl(200, 60%, 45%)', defaultDurationMin: 60,  defaultStartHour: 9,  defaultStartMin: 0, pickerVisible: false },
  { id: 'home',               name: 'Home',        emoji: '🏠',  color: 'hsl(160, 50%, 45%)', defaultDurationMin: 60,  defaultStartHour: 9,  defaultStartMin: 0, pickerVisible: false },
  { id: 'airport_processing', name: 'Airport',     emoji: '🛃',  color: 'hsl(210, 50%, 60%)', defaultDurationMin: 120, defaultStartHour: 8,  defaultStartMin: 0, pickerVisible: false },
  { id: 'transport',          name: 'Transport',   emoji: '🚌',  color: 'hsl(200, 50%, 60%)', defaultDurationMin: 30,  defaultStartHour: 9,  defaultStartMin: 0, pickerVisible: false },
];

/** Categories shown in the picker UI */
export const PICKER_CATEGORIES = PREDEFINED_CATEGORIES.filter(c => c.pickerVisible !== false);

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
