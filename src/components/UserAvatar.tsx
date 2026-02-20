import { cn } from '@/lib/utils';

interface UserAvatarProps {
  name: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-16 w-16 text-2xl',
};

const nameToHue = (name: string): number => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ((hash % 360) + 360) % 360;
};

const getInitials = (name: string | null | undefined): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.trim().charAt(0).toUpperCase();
};

const UserAvatar = ({ name, size = 'md', className }: UserAvatarProps) => {
  const initials = getInitials(name);
  const hue = nameToHue(name || 'User');

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full font-semibold text-white select-none shrink-0',
        SIZE_MAP[size],
        className,
      )}
      style={{ backgroundColor: `hsl(${hue}, 55%, 48%)` }}
    >
      {initials}
    </div>
  );
};

export default UserAvatar;
