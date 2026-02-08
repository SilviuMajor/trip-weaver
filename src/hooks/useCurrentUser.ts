import { useState, useEffect } from 'react';
import type { TripUser } from '@/types/trip';

const USER_STORAGE_KEY = 'trip-planner-current-user';

export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState<TripUser | null>(() => {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, [currentUser]);

  const login = (user: TripUser) => {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    setCurrentUser(user);
  };
  const logout = () => {
    localStorage.removeItem(USER_STORAGE_KEY);
    setCurrentUser(null);
  };

  const isOrganizer = currentUser?.role === 'organizer';
  const isEditor = currentUser?.role === 'editor' || isOrganizer;

  return { currentUser, login, logout, isOrganizer, isEditor };
}
