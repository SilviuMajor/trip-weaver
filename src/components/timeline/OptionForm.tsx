import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface OptionFormProps {
  entryId: string;
  onSaved: () => void;
}

const COLOR_PRESETS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
  '#1abc9c', '#3498db', '#9b59b6', '#6366f1',
];

const OptionForm = ({ entryId, onSaved }: OptionFormProps) => {
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [category, setCategory] = useState('');
  const [categoryColor, setCategoryColor] = useState('#6366f1');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('entry_options').insert({
        entry_id: entryId,
        name: name.trim(),
        website: website.trim() || null,
        category: category.trim() || null,
        category_color: category.trim() ? categoryColor : null,
        location_name: locationName.trim() || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      });

      if (error) throw error;
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
        <Label htmlFor="opt-category">Category</Label>
        <Input
          id="opt-category"
          placeholder="e.g. Food, Travel, Culture"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        {category && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Color:</span>
            <div className="flex gap-1">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategoryColor(c)}
                  className={`h-5 w-5 rounded-full border-2 transition-all ${
                    categoryColor === c ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        )}
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

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="opt-lat">Latitude</Label>
          <Input
            id="opt-lat"
            type="number"
            step="any"
            placeholder="52.3676"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="opt-lng">Longitude</Label>
          <Input
            id="opt-lng"
            type="number"
            step="any"
            placeholder="4.9041"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
          />
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? 'Saving…' : 'Save Option'}
      </Button>
    </div>
  );
};

export default OptionForm;
