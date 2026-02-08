import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WizardStepProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  canSkip?: boolean;
  onSkip?: () => void;
  children: React.ReactNode;
}

const WizardStep = ({
  currentStep,
  totalSteps,
  stepLabels,
  onBack,
  onNext,
  nextLabel = 'Next',
  nextDisabled,
  canSkip,
  onSkip,
  children,
}: WizardStepProps) => {
  return (
    <div>
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Progress dots */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {stepLabels.map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-2 rounded-full transition-all',
              i === currentStep
                ? 'w-6 bg-primary'
                : i < currentStep
                  ? 'w-2 bg-primary/50'
                  : 'w-2 bg-muted'
            )}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="mb-8">{children}</div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        {canSkip ? (
          <button
            onClick={onSkip}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Skip
          </button>
        ) : (
          <div />
        )}
        <Button onClick={onNext} disabled={nextDisabled}>
          {nextLabel}
        </Button>
      </div>
    </div>
  );
};

export default WizardStep;
