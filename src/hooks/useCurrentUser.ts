import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, [currentUser]);

  // Check for admin auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAdminLoggedIn(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsAdminLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = (user: TripUser) => {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    setCurrentUser(user);
  };
  const logout = () => {
    localStorage.removeItem(USER_STORAGE_KEY);
    setCurrentUser(null);
  };

  // Admin gets organizer permissions regardless of selected trip member
  const isOrganizer = currentUser?.role === 'organizer' || isAdminLoggedIn;
  const isEditor = currentUser?.role === 'editor' || isOrganizer;

  return { currentUser, login, logout, isOrganizer, isEditor, isAdminLoggedIn };
}
