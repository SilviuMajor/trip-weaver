import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { addDays, parseISO, startOfDay, format } from 'date-fns';
import { ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTimezone } from '@/hooks/useTimezone';
import TimelineHeader from '@/components/timeline/TimelineHeader';
import TimelineDay from '@/components/timeline/TimelineDay';
import type { Trip, Entry, EntryOption, EntryWithOptions } from '@/types/trip';

const Timeline = () => {
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const { timezone, toggle, formatTime, getTimezoneLabel } = useTimezone();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [entries, setEntries] = useState<EntryWithOptions[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Redirect if no user
  useEffect(() => {
    if (!currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  // Fetch trip and entries
  useEffect(() => {
    const fetchData = async () => {
      // Get the first (only) trip
      const { data: tripData } = await supabase
        .from('trips')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (!tripData) {
        setLoading(false);
        return;
      }

      setTrip(tripData as Trip);

      // Get all entries with their options
      const { data: entriesData } = await supabase
        .from('entries')
        .select('*')
        .eq('trip_id', tripData.id)
        .order('start_time');

      if (!entriesData || entriesData.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }

      const entryIds = entriesData.map(e => e.id);

      // Fetch options for all entries
      const { data: optionsData } = await supabase
        .from('entry_options')
        .select('*')
        .in('entry_id', entryIds);

      // Fetch vote counts per option
      const { data: votesData } = await supabase
        .from('votes')
        .select('option_id');

      // Count votes per option
      const voteCounts: Record<string, number> = {};
      votesData?.forEach(v => {
        voteCounts[v.option_id] = (voteCounts[v.option_id] || 0) + 1;
      });

      // Assemble entries with options
      const entriesWithOptions: EntryWithOptions[] = (entriesData as Entry[]).map(entry => ({
        ...entry,
        options: ((optionsData as EntryOption[]) || [])
          .filter(o => o.entry_id === entry.id)
          .map(o => ({ ...o, vote_count: voteCounts[o.id] || 0 })),
      }));

      setEntries(entriesWithOptions);
      setLoading(false);
    };

    fetchData();
  }, []);

  // Scroll to today on load
  useEffect(() => {
    if (!loading) {
      const todayEl = document.getElementById('today');
      if (todayEl) {
        setTimeout(() => {
          todayEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    }
  }, [loading]);

  const scrollToToday = () => {
    const todayEl = document.getElementById('today');
    if (todayEl) {
      todayEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Generate days between trip start and end
  const getDays = (): Date[] => {
    if (!trip) return [];
    const start = parseISO(trip.start_date);
    const end = parseISO(trip.end_date);
    const days: Date[] = [];
    let current = startOfDay(start);
    while (current <= end) {
      days.push(new Date(current));
      current = addDays(current, 1);
    }
    return days;
  };

  // Group entries by day
  const getEntriesForDay = (day: Date): EntryWithOptions[] => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return entries.filter(entry => {
      const entryDay = format(new Date(entry.start_time), 'yyyy-MM-dd');
      return entryDay === dayStr;
    });
  };

  if (!currentUser) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background" ref={scrollRef}>
      <TimelineHeader
        trip={trip}
        timezone={timezone}
        onToggleTimezone={toggle}
        timezoneLabel={getTimezoneLabel()}
      />

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading itinerary...</p>
          </div>
        </div>
      ) : !trip ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center">
            <h2 className="mb-2 text-xl font-bold">No trip found</h2>
            <p className="text-sm text-muted-foreground">
              Create a trip in the backend to get started.
            </p>
          </div>
        </div>
      ) : (
        <>
          <main className="flex-1 pb-20">
            {getDays().map(day => (
              <TimelineDay
                key={day.toISOString()}
                date={day}
                entries={getEntriesForDay(day)}
                formatTime={formatTime}
              />
            ))}
          </main>

          {/* Today quick-jump button */}
          <div className="fixed bottom-6 right-6 z-40">
            <Button
              onClick={scrollToToday}
              size="sm"
              className="rounded-full shadow-lg"
            >
              <ArrowDown className="mr-1 h-3.5 w-3.5" />
              Today
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default Timeline;
