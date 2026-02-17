import { Undo2, Redo2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UndoRedoButtonsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  sidebarOpen?: boolean;
  isMobile?: boolean;
  compact?: boolean;
}

const UndoRedoButtons = ({ canUndo, canRedo, onUndo, onRedo, sidebarOpen, isMobile, compact }: UndoRedoButtonsProps) => {
  return (
    <div className={cn(
      "fixed bottom-4 z-50 flex items-center gap-1 rounded-full border border-border bg-background/90 backdrop-blur-sm shadow-lg px-1 py-1 transition-all duration-200",
      sidebarOpen && !isMobile
        ? compact ? 'right-[calc(25vw+100px)]' : 'right-[calc(30vw+100px)]'
        : 'right-[88px]'
    )}>
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
          canUndo
            ? 'text-foreground hover:bg-muted'
            : 'text-muted-foreground/30 cursor-not-allowed'
        )}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="h-4 w-4" />
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
          canRedo
            ? 'text-foreground hover:bg-muted'
            : 'text-muted-foreground/30 cursor-not-allowed'
        )}
        title="Redo (Ctrl+Shift+Z)"
      >
        <Redo2 className="h-4 w-4" />
      </button>
    </div>
  );
};

export default UndoRedoButtons;
