import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X } from 'lucide-react';
import { PREDEFINED_CATEGORIES } from '@/lib/categories';
import type { CategoryPreset } from '@/types/trip';

interface CategoryStepProps {
  categories: CategoryPreset[];
  onChange: (cats: CategoryPreset[]) => void;
}

const CategoryStep = ({ categories, onChange }: CategoryStepProps) => {
  const [customName, setCustomName] = useState('');
  const [customEmoji, setCustomEmoji] = useState('📌');

  const PRESET_COLORS = [
    'hsl(200, 70%, 50%)', 'hsl(24, 85%, 55%)', 'hsl(160, 50%, 45%)',
    'hsl(260, 50%, 55%)', 'hsl(340, 65%, 50%)', 'hsl(45, 80%, 50%)',
  ];

  const addCustomCategory = () => {
    if (!customName.trim()) return;
    const color = PRESET_COLORS[categories.length % PRESET_COLORS.length];
    onChange([...categories, { name: customName.trim(), color, emoji: customEmoji }]);
    setCustomName('');
    setCustomEmoji('📌');
  };

  const removeCategory = (index: number) => {
    onChange(categories.filter((_, i) => i !== index));
  };

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold">Custom categories</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        These are always available when adding entries:
      </p>

      {/* Predefined categories preview */}
      <div className="mb-6 flex flex-wrap gap-2">
        {PREDEFINED_CATEGORIES.map((cat) => (
          <span
            key={cat.id}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-white"
            style={{ backgroundColor: cat.color }}
          >
            {cat.emoji} {cat.name}
          </span>
        ))}
      </div>

      <p className="mb-3 text-sm text-muted-foreground">
        Add your own categories for this trip:
      </p>

      <div className="mb-4 flex gap-2">
        <Input
          value={customEmoji}
          onChange={(e) => setCustomEmoji(e.target.value)}
          className="w-14 text-center text-lg"
          maxLength={2}
        />
        <Input
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="e.g. Spa, Museum"
          className="flex-1"
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomCategory())}
        />
        <Button variant="outline" size="icon" onClick={addCustomCategory}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium text-white"
              style={{ backgroundColor: cat.color }}
            >
              {cat.emoji} {cat.name}
              <button onClick={() => removeCategory(i)} className="ml-1 hover:opacity-70">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryStep;
