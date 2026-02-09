import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, CloudDrizzle, Moon, CloudMoon, CloudSun } from 'lucide-react';

const getWeatherIcon = (condition: string | null, isNight: boolean) => {
  if (!condition) return isNight ? Moon : Sun;
  const lower = condition.toLowerCase();
  if (lower.includes('thunder')) return CloudLightning;
  if (lower.includes('snow')) return CloudSnow;
  if (lower.includes('rain') || lower.includes('shower')) return CloudRain;
  if (lower.includes('drizzle')) return CloudDrizzle;
  if (lower.includes('fog')) return CloudFog;
  if (lower.includes('partly') || lower.includes('cloud')) return isNight ? CloudMoon : CloudSun;
  if (lower.includes('overcast')) return Cloud;
  if (lower.includes('clear')) return isNight ? Moon : Sun;
  return isNight ? Moon : Sun;
};

function getWeatherColor(condition: string | null, isNight: boolean): { bg: string; text: string } {
  const lower = (condition || '').toLowerCase();
  if (isNight) {
    if (lower.includes('rain') || lower.includes('shower') || lower.includes('drizzle') || lower.includes('thunder'))
      return { bg: 'hsl(215, 25%, 16%)', text: 'white' };
    if (lower.includes('cloud') || lower.includes('overcast'))
      return { bg: 'hsl(220, 15%, 22%)', text: 'white' };
    return { bg: 'hsl(225, 40%, 18%)', text: 'white' };
  }
  if (lower.includes('thunder')) return { bg: 'hsl(230, 35%, 38%)', text: 'white' };
  if (lower.includes('rain') || lower.includes('shower') || lower.includes('drizzle'))
    return { bg: 'hsl(210, 35%, 45%)', text: 'white' };
  if (lower.includes('overcast')) return { bg: 'hsl(210, 20%, 55%)', text: 'white' };
  if (lower.includes('partly') || lower.includes('cloud'))
    return { bg: 'hsl(200, 50%, 70%)', text: 'hsl(220, 20%, 15%)' };
  if (lower.includes('snow')) return { bg: 'hsl(200, 15%, 82%)', text: 'hsl(220, 20%, 15%)' };
  if (lower.includes('fog')) return { bg: 'hsl(200, 10%, 68%)', text: 'hsl(220, 20%, 15%)' };
  return { bg: 'hsl(45, 80%, 72%)', text: 'hsl(220, 20%, 15%)' };
}

interface WeatherBadgeProps {
  temp: number | null;
  condition: string | null;
  hour: number;
  date: Date;
  latitude?: number;
  longitude?: number;
}

const WeatherBadge = ({ temp, condition, hour }: WeatherBadgeProps) => {
  if (temp === null) return null;

  const isNight = hour < 6 || hour >= 21;
  const Icon = getWeatherIcon(condition, isNight);
  const { bg, text } = getWeatherColor(condition, isNight);

  return (
    <div
      className="flex flex-col items-center justify-center w-9 h-9 rounded-full shadow-sm transition-colors duration-500"
      style={{ backgroundColor: bg, color: text }}
    >
      <Icon className="h-4 w-4" strokeWidth={3} />
      <span className="text-[9px] font-bold leading-none mt-0.5">{Math.round(temp)}°</span>
    </div>
  );
};

export default WeatherBadge;
