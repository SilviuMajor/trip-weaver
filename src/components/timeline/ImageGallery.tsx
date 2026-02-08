import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OptionImage } from '@/types/trip';

interface ImageGalleryProps {
  images: OptionImage[];
}

const ImageGallery = ({ images }: ImageGalleryProps) => {
  const [current, setCurrent] = useState(0);

  if (images.length === 0) return null;

  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="aspect-[16/10] w-full">
        <img
          src={sorted[current].image_url}
          alt={`Image ${current + 1}`}
          className="h-full w-full object-cover"
        />
      </div>

      {sorted.length > 1 && (
        <>
          <button
            onClick={() => setCurrent(prev => (prev > 0 ? prev - 1 : sorted.length - 1))}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-foreground/40 p-1 text-background backdrop-blur-sm transition-colors hover:bg-foreground/60"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCurrent(prev => (prev < sorted.length - 1 ? prev + 1 : 0))}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-foreground/40 p-1 text-background backdrop-blur-sm transition-colors hover:bg-foreground/60"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
            {sorted.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === current ? 'w-4 bg-background' : 'w-1.5 bg-background/50'
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ImageGallery;
