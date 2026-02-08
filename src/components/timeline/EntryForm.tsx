import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import OptionForm from './OptionForm';

interface EntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  onCreated: () => void;
}

const EntryForm = ({ open, onOpenChange, tripId, onCreated }: EntryFormProps) => {
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'time' | 'option'>('time');
  const [entryId, setEntryId] = useState<string | null>(null);

  const reset = () => {
    setDate('');
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
    if (!date) {
      toast({ title: 'Please select a date', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const startIso = `${date}T${startTime}:00+00:00`;
      const endIso = `${date}T${endTime}:00+00:00`;

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
              <Label htmlFor="entry-date">Date</Label>
              <Input
                id="entry-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
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
