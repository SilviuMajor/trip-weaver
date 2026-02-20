import { supabase } from '@/integrations/supabase/client';

export type CachedReview = {
  text: string;
  rating: number | null;
  author: string;
  relativeTime: string;
};

// Module-level caches — persist for the browser session
const reviewData = new Map<string, CachedReview[]>();
const inflight = new Map<string, Promise<CachedReview[]>>();

/**
 * Get cached reviews for a place (synchronous, returns null if not cached yet).
 */
export function getCachedReviews(placeId: string): CachedReview[] | null {
  return reviewData.get(placeId) ?? null;
}

/**
 * Prefetch reviews for a place. Safe to call multiple times —
 * deduplicates in-flight requests and caches the result.
 */
export function prefetchReviews(placeId: string): Promise<CachedReview[]> {
  if (reviewData.has(placeId)) {
    return Promise.resolve(reviewData.get(placeId)!);
  }

  if (inflight.has(placeId)) {
    return inflight.get(placeId)!;
  }

  const promise = supabase.functions
    .invoke('google-places', {
      body: { action: 'details', placeId },
    })
    .then(({ data }) => {
      const reviews: CachedReview[] = data?.reviews?.length > 0
        ? [...data.reviews]
            .sort((a: any, b: any) => (b.rating ?? 0) - (a.rating ?? 0))
            .slice(0, 5)
        : [];
      reviewData.set(placeId, reviews);
      return reviews;
    })
    .catch(() => {
      const empty: CachedReview[] = [];
      reviewData.set(placeId, empty);
      return empty;
    })
    .finally(() => {
      inflight.delete(placeId);
    });

  inflight.set(placeId, promise);
  return promise;
}

/**
 * Seed the cache with already-known reviews (e.g. from ExploreView preloadedReviews).
 */
export function seedReviewCache(placeId: string, reviews: CachedReview[]): void {
  if (!reviewData.has(placeId)) {
    reviewData.set(placeId, reviews);
  }
}
