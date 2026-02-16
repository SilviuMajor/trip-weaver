import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineFieldProps {
  value: string;
  canEdit: boolean;
  onSave: (newValue: string) => Promise<void>;
  renderDisplay?: (val: string) => React.ReactNode;
  renderInput?: (val: string, onChange: (v: string) => void, onDone: () => void) => React.ReactNode;
  className?: string;
  inputType?: string;
  placeholder?: string;
}

const InlineField = ({ value, canEdit, onSave, renderDisplay, renderInput, className, inputType = 'text', placeholder }: InlineFieldProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);

  // Sync displayValue when the prop actually updates (after refetch)
  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const handleDone = async () => {
    if (draft !== displayValue) {
      setSaving(true);
      await onSave(draft);
      // Optimistically show the saved value immediately
      setDisplayValue(draft);
      setSaving(false);
    }
    setEditing(false);
  };

  if (editing && canEdit) {
    if (renderInput) {
      return <>{renderInput(draft, setDraft, handleDone)}</>;
    }
    return (
      <Input
        type={inputType}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={handleDone}
        onKeyDown={e => { if (e.key === 'Enter') handleDone(); if (e.key === 'Escape') { setDraft(displayValue); setEditing(false); } }}
        autoFocus
        disabled={saving}
        placeholder={placeholder}
        className={cn('h-8', className)}
      />
    );
  }

  const shown = renderDisplay ? renderDisplay(displayValue) : <span>{displayValue || <span className="text-muted-foreground italic">{placeholder || 'Empty'}</span>}</span>;

  return (
    <div
      className={cn('group inline-flex items-center gap-1.5', canEdit && 'cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors', className)}
      onClick={() => { if (canEdit) { setDraft(displayValue); setEditing(true); } }}
    >
      {shown}
      {canEdit && <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
    </div>
  );
};

export default InlineField;
