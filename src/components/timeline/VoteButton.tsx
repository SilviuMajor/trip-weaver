import { useState } from 'react';
import { motion } from 'framer-motion';
import { ThumbsUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface VoteButtonProps {
  optionId: string;
  userId: string;
  voteCount: number;
  hasVoted: boolean;
  locked: boolean;
  onVoteChange?: () => void;
}

const VoteButton = ({ optionId, userId, voteCount, hasVoted, locked, onVoteChange }: VoteButtonProps) => {
  const [busy, setBusy] = useState(false);

  if (locked) return null;

  const handleVote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);

    try {
      if (hasVoted) {
        await supabase
          .from('votes')
          .delete()
          .eq('option_id', optionId)
          .eq('user_id', userId);
      } else {
        await supabase
          .from('votes')
          .insert({ option_id: optionId, user_id: userId });
      }
      onVoteChange?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={handleVote}
      disabled={busy}
      className={cn(
        'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
        hasVoted
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-primary/10'
      )}
    >
      <ThumbsUp className="h-3 w-3" />
      <span>{voteCount}</span>
    </motion.button>
  );
};

export default VoteButton;
