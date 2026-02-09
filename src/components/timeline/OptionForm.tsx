import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { PREDEFINED_CATEGORIES, TRAVEL_MODES } from '@/lib/categories';
import type { CategoryPreset, EntryOption } from '@/types/trip';

interface OptionFormProps {
  entryId: string;
  onSaved: () => void;
  customCategories?: CategoryPreset[];
  editOption?: EntryOption | null;
}

const OptionForm = ({ entryId, onSaved, customCategories = [], editOption }: OptionFormProps) => {
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [travelMode, setTravelMode] = useState('transit');
  const [locationName, setLocationName] = useState('');
  const [saving, setSaving] = useState(false);

  const isEditing = !!editOption;

  const allCategories = [
    ...PREDEFINED_CATEGORIES.map(c => ({ id: c.id, name: c.name, emoji: c.emoji, color: c.color })),
    ...customCategories.map((c, i) => ({ id: `custom_${i}`, name: c.name, emoji: c.emoji || '📌', color: c.color })),
  ];

  useEffect(() => {
    if (editOption) {
      setName(editOption.name);
      setWebsite(editOption.website ?? '');
      setCategoryId(editOption.category ?? '');
      setLocationName(editOption.location_name ?? '');
    }
  }, [editOption]);

  const selectedCategory = categoryId ? allCategories.find(c => c.id === categoryId) : null;
  const isTransfer = categoryId === 'transfer';

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }

    const cat = selectedCategory;
    const displayColor = cat?.color ?? null;

    setSaving(true);
    try {
      const payload = {
        entry_id: entryId,
        name: name.trim(),
        website: website.trim() || null,
        category: cat ? cat.id : null,
        category_color: displayColor,
        location_name: locationName.trim() || null,
        latitude: null,
        longitude: null,
      };

      if (isEditing && editOption) {
        const { error } = await supabase
          .from('entry_options')
          .update(payload)
          .eq('id', editOption.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('entry_options')
          .insert(payload);
        if (error) throw error;
      }

      onSaved();
    } catch (err: any) {
      toast({ title: 'Failed to save option', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a category…" />
          </SelectTrigger>
          <SelectContent className="bg-popover max-h-60">
            {allCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                <span className="flex items-center gap-2">
                  <span>{cat.emoji}</span>
                  <span>{cat.name}</span>
                  <span
                    className="ml-auto inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isTransfer && (
        <div className="space-y-2">
          <Label>Travel mode</Label>
          <div className="grid grid-cols-2 gap-2">
            {TRAVEL_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setTravelMode(mode.id)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                  travelMode === mode.id
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40'
                }`}
              >
                <span className="text-base">{mode.emoji}</span>
                <span>{mode.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="opt-name">Name *</Label>
        <Input
          id="opt-name"
          placeholder="e.g. Anne Frank House"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="opt-website">Website</Label>
        <Input
          id="opt-website"
          type="url"
          placeholder="https://..."
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="opt-location">Location Name</Label>
        <Input
          id="opt-location"
          placeholder="e.g. Dam Square"
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
        />
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? 'Saving…' : (isEditing ? 'Update Option' : 'Save Option')}
      </Button>
    </div>
  );
};

export default OptionForm;
