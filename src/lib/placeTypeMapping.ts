// Maps our app categories to Google Places types for Nearby Search
export const CATEGORY_TO_PLACE_TYPES: Record<string, string[]> = {
  breakfast: ['restaurant', 'cafe', 'bakery'],
  lunch: ['restaurant'],
  dinner: ['restaurant'],
  drinks: ['bar', 'night_club'],
  nightlife: ['night_club', 'bar'],
  coffee_shop: ['cafe', 'coffee_shop'],
  museum: ['museum', 'art_gallery'],
  activity: ['tourist_attraction', 'amusement_park', 'aquarium', 'zoo'],
  sightseeing: ['tourist_attraction', 'church', 'hindu_temple', 'mosque', 'synagogue'],
  shopping: ['shopping_mall', 'clothing_store', 'department_store', 'market'],
  park: ['park', 'national_park'],
};

// Returns search placeholder text based on category
export const getCategorySearchPlaceholder = (categoryId: string | null, destination: string | null): string => {
  const city = destination || 'this area';
  if (!categoryId) return `Search places in ${city}...`;
  const labels: Record<string, string> = {
    breakfast: `Search breakfast spots in ${city}...`,
    lunch: `Search restaurants in ${city}...`,
    dinner: `Search restaurants in ${city}...`,
    drinks: `Search bars in ${city}...`,
    nightlife: `Search nightlife in ${city}...`,
    coffee_shop: `Search coffee shops in ${city}...`,
    museum: `Search museums in ${city}...`,
    activity: `Search activities in ${city}...`,
    sightseeing: `Search landmarks in ${city}...`,
    shopping: `Search shopping in ${city}...`,
    park: `Search parks in ${city}...`,
  };
  return labels[categoryId] || `Search ${categoryId} in ${city}...`;
};

// Infer app category from Google Places types + time of day
export const inferCategoryFromTypes = (types: string[]): string => {
  const hour = new Date().getHours();
  const typeSet = new Set(types);

  if (typeSet.has('restaurant') || typeSet.has('cafe') || typeSet.has('bakery')) {
    if (hour < 11) return 'breakfast';
    if (hour < 15) return 'lunch';
    if (hour >= 17) return 'dinner';
    return 'lunch';
  }
  if (typeSet.has('bar') || typeSet.has('night_club')) {
    return hour >= 21 ? 'nightlife' : 'drinks';
  }
  if (typeSet.has('museum') || typeSet.has('art_gallery')) return 'museum';
  if (typeSet.has('park') || typeSet.has('national_park')) return 'park';
  if (typeSet.has('shopping_mall') || typeSet.has('clothing_store') || typeSet.has('department_store')) return 'shopping';
  if (typeSet.has('tourist_attraction') || typeSet.has('church')) return 'sightseeing';

  return 'activity';
};
