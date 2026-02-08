import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X } from 'lucide-react';
import type { CategoryPreset } from '@/types/trip';

interface CategoryStepProps {
  categories: CategoryPreset[];
  onChange: (cats: CategoryPreset[]) => void;
}

const PRESET_COLORS = [
  'hsl(200, 70%, 50%)',
  'hsl(24, 85%, 55%)',
  'hsl(160, 50%, 45%)',
  'hsl(260, 50%, 55%)',
  'hsl(340, 65%, 50%)',
  'hsl(45, 80%, 50%)',
];

const CategoryStep = ({ categories, onChange }: CategoryStepProps) => {
  const [name, setName] = useState('');

  const addCategory = () => {
    if (!name.trim()) return;
    const color = PRESET_COLORS[categories.length % PRESET_COLORS.length];
    onChange([...categories, { name: name.trim(), color }]);
    setName('');
  };

  const removeCategory = (index: number) => {
    onChange(categories.filter((_, i) => i !== index));
  };

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold">Activity categories</h2>
      <p className="mb-6 text-sm text-muted-foreground">Optional labels for your entries</p>

      <div className="mb-4 flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Food, Travel, Chill"
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory())}
        />
        <Button variant="outline" size="icon" onClick={addCategory}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((cat, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium text-white"
            style={{ backgroundColor: cat.color }}
          >
            {cat.name}
            <button onClick={() => removeCategory(i)} className="ml-1 hover:opacity-70">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
};

export default CategoryStep;
