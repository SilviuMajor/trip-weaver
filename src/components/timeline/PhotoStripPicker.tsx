import { useState } from 'react';
import { X } from 'lucide-react';

interface PhotoStripPickerProps {
  photos: string[];
  onChange: (photos: string[]) => void;
}

const PhotoStripPicker = ({ photos, onChange }: PhotoStripPickerProps) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleReorder = (from: number | null, to: number) => {
    if (from === null || from === to) return;
    const copy = [...photos];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    onChange(copy);
  };

  const removePhoto = (index: number) => {
    onChange(photos.filter((_, i) => i !== index));
  };

  if (photos.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
      {photos.map((url, i) => (
        <div
          key={`${url}-${i}`}
          draggable
          onDragStart={() => setDragIndex(i)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverIndex(i);
          }}
          onDragLeave={() => setDragOverIndex(null)}
          onDrop={() => {
            handleReorder(dragIndex, i);
            setDragIndex(null);
            setDragOverIndex(null);
          }}
          onDragEnd={() => {
            setDragIndex(null);
            setDragOverIndex(null);
          }}
          className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all duration-150
            ${dragIndex === i ? 'opacity-40 scale-95' : ''}
            ${dragOverIndex === i && dragIndex !== i ? 'border-primary ring-2 ring-primary/30' : ''}
            ${i === 0 && dragOverIndex !== i ? 'border-primary' : dragOverIndex !== i ? 'border-border' : ''}
          `}
        >
          <img src={url} className="w-full h-full object-cover" alt="" loading="lazy" />
          {i === 0 && (
            <span className="absolute bottom-0 left-0 bg-primary text-primary-foreground text-[9px] px-1.5 py-0.5 rounded-tr-md font-medium">
              Cover
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removePhoto(i);
            }}
            className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 hover:bg-black/80 transition-colors"
          >
            <X className="h-3 w-3 text-white" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default PhotoStripPicker;
