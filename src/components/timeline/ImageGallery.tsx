import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OptionImage } from '@/types/trip';

interface ImageGalleryProps {
  images: OptionImage[];
  height?: number;
  rounded?: boolean;
}

const ImageGallery = ({ images, height = 220, rounded = true }: ImageGalleryProps) => {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);

  if (images.length === 0) return null;

  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order);

  const goNext = () => setCurrent(prev => (prev < sorted.length - 1 ? prev + 1 : 0));
  const goPrev = () => setCurrent(prev => (prev > 0 ? prev - 1 : sorted.length - 1));

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };
  const handleTouchEnd = () => {
    if (Math.abs(touchDeltaX.current) > 50) {
      if (touchDeltaX.current < 0) goNext();
      else goPrev();
    }
    touchStartX.current = null;
    touchDeltaX.current = 0;
  };

  return (
    <div className={cn("relative overflow-hidden", rounded && "rounded-xl")} style={{ height, minHeight: height }}>
      <div
        className="w-full h-full"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={sorted[current].image_url}
          alt={`Image ${current + 1}`}
          className="h-full w-full object-cover"
          style={{ minHeight: height }}
          draggable={false}
        />
        {sorted[current].attribution && (
          <span className="absolute bottom-2 right-2 text-[9px] text-white/70 bg-black/30 px-1.5 py-0.5 rounded backdrop-blur-sm pointer-events-none">
            Photo by {sorted[current].attribution}
          </span>
        )}
      </div>

      {sorted.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-foreground/40 p-1 text-background backdrop-blur-sm transition-colors hover:bg-foreground/60"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goNext}
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
