import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X } from 'lucide-react';

interface MemberDraft {
  name: string;
  role: 'organizer' | 'editor' | 'viewer';
}

interface MembersStepProps {
  members: MemberDraft[];
  onChange: (members: MemberDraft[]) => void;
}

const MembersStep = ({ members, onChange }: MembersStepProps) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState<'organizer' | 'editor' | 'viewer'>('editor');

  const addMember = () => {
    if (!name.trim()) return;
    onChange([...members, { name: name.trim(), role }]);
    setName('');
  };

  const removeMember = (index: number) => {
    onChange(members.filter((_, i) => i !== index));
  };

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold">Who's coming?</h2>
      <p className="mb-6 text-sm text-muted-foreground">Add trip members and their roles</p>

      <div className="mb-4 flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="flex-1"
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMember())}
        />
        <Select value={role} onValueChange={(v) => setRole(v as 'organizer' | 'editor' | 'viewer')}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="organizer">Organizer</SelectItem>
            <SelectItem value="editor">Editor</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={addMember}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {members.map((m, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
            <div>
              <p className="font-medium">{m.name}</p>
              <p className="text-xs capitalize text-muted-foreground">{m.role}</p>
            </div>
            <button onClick={() => removeMember(i)} className="text-muted-foreground hover:text-destructive">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MembersStep;
