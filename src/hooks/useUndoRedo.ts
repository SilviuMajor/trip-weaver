import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

export interface UndoAction {
  description: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

export function useUndoRedo(onAfterAction?: () => Promise<void>) {
  const [past, setPast] = useState<UndoAction[]>([]);
  const [future, setFuture] = useState<UndoAction[]>([]);

  const pushAction = useCallback((action: UndoAction) => {
    setPast(prev => [...prev, action]);
    setFuture([]);
  }, []);

  const undo = useCallback(async () => {
    setPast(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const rest = prev.slice(0, -1);
      last.undo().then(() => {
        onAfterAction?.();
        toast.success(`Undone: ${last.description}`);
      });
      setFuture(f => [...f, last]);
      return rest;
    });
  }, [onAfterAction]);

  const redo = useCallback(async () => {
    setFuture(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const rest = prev.slice(0, -1);
      last.redo().then(() => {
        onAfterAction?.();
        toast.success(`Redone: ${last.description}`);
      });
      setPast(p => [...p, last]);
      return rest;
    });
  }, [onAfterAction]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  return { canUndo, canRedo, undo, redo, pushAction };
}
