import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, CloudDrizzle } from 'lucide-react';

const getWeatherIcon = (condition: string | null) => {
  if (!condition) return null;
  const lower = condition.toLowerCase();
  if (lower.includes('thunder')) return CloudLightning;
  if (lower.includes('snow')) return CloudSnow;
  if (lower.includes('rain') || lower.includes('shower')) return CloudRain;
  if (lower.includes('drizzle')) return CloudDrizzle;
  if (lower.includes('fog')) return CloudFog;
  if (lower.includes('partly') || lower.includes('cloud')) return Cloud;
  if (lower.includes('clear')) return Sun;
  return Sun;
};

interface WeatherBadgeProps {
  temp: number | null;
  condition: string | null;
}

const WeatherBadge = ({ temp, condition }: WeatherBadgeProps) => {
  const Icon = getWeatherIcon(condition);
  if (!Icon || temp === null) return null;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground shadow-sm">
      <Icon className="h-3.5 w-3.5" />
      <span>{Math.round(temp)}°</span>
    </div>
  );
};

export default WeatherBadge;
