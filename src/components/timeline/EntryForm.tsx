import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { addDays, format, parseISO } from 'date-fns';
import OptionForm from './OptionForm';
import type { Trip } from '@/types/trip';

const REFERENCE_DATE = '2099-01-01';

interface EntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  onCreated: () => void;
  trip?: Trip | null;
}

const EntryForm = ({ open, onOpenChange, tripId, onCreated, trip }: EntryFormProps) => {
  const [date, setDate] = useState('');
  const [selectedDay, setSelectedDay] = useState('0');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'time' | 'option'>('time');
  const [entryId, setEntryId] = useState<string | null>(null);

  const isUndated = !trip?.start_date;
  const dayCount = trip?.duration_days ?? 3;

  const reset = () => {
    setDate('');
    setSelectedDay('0');
    setStartTime('09:00');
    setEndTime('10:00');
    setStep('time');
    setEntryId(null);
    setSaving(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleCreateEntry = async () => {
    const entryDate = isUndated
      ? format(addDays(parseISO(REFERENCE_DATE), Number(selectedDay)), 'yyyy-MM-dd')
      : date;

    if (!entryDate) {
      toast({ title: 'Please select a date', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const startIso = `${entryDate}T${startTime}:00+00:00`;
      const endIso = `${entryDate}T${endTime}:00+00:00`;

      const { data, error } = await supabase
        .from('entries')
        .insert({ trip_id: tripId, start_time: startIso, end_time: endIso })
        .select('id')
        .single();

      if (error) throw error;

      setEntryId(data.id);
      setStep('option');
    } catch (err: any) {
      toast({ title: 'Failed to create entry', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleOptionSaved = () => {
    onCreated();
    handleClose(false);
    toast({ title: 'Entry created!' });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {step === 'time' ? 'New Entry' : 'Add Option'}
          </DialogTitle>
        </DialogHeader>

        {step === 'time' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              {isUndated ? (
                <>
                  <Label>Day</Label>
                  <Select value={selectedDay} onValueChange={setSelectedDay}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {Array.from({ length: dayCount }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          Day {i + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              ) : (
                <>
                  <Label htmlFor="entry-date">Date</Label>
                  <Input
                    id="entry-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="entry-start">Start</Label>
                <Input
                  id="entry-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entry-end">End</Label>
                <Input
                  id="entry-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleCreateEntry} disabled={saving}>
                {saving ? 'Creating…' : 'Next: Add Option'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          entryId && <OptionForm entryId={entryId} onSaved={handleOptionSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EntryForm;
