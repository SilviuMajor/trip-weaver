import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import type { ConflictInfo, Recommendation } from '@/lib/conflictEngine';

interface ConflictResolverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflict: ConflictInfo | null;
  recommendations: Recommendation[];
  onApply: (recommendation: Recommendation) => void;
  onSkip: () => void;
}

const ConflictResolver = ({
  open,
  onOpenChange,
  conflict,
  recommendations,
  onApply,
  onSkip,
}: ConflictResolverProps) => {
  if (!conflict) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Schedule Conflict
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Problem description */}
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium">
                  Placing "{conflict.entryName}" requires{' '}
                  <span className="font-bold text-destructive">{conflict.discrepancyMin} extra minutes</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Travel time exceeds the available gap between entries
                </p>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Suggestions
              </p>
              {recommendations.map(rec => (
                <button
                  key={rec.id}
                  onClick={() => onApply(rec)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-primary hover:bg-primary/5"
                >
                  <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{rec.label}</p>
                    <p className="text-xs text-muted-foreground">{rec.description}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onSkip}>
            I'll figure it out myself
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConflictResolver;
