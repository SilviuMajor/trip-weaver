import { cn } from '@/lib/utils';

interface BrandProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
};

const Brand = ({ size = 'md', className }: BrandProps) => (
  <span className={cn('font-extrabold tracking-tight', sizeMap[size], className)}>
    <span className="text-foreground">tr</span>
    <span className="text-primary">1</span>
    <span className="text-foreground">p</span>
  </span>
);

export default Brand;
