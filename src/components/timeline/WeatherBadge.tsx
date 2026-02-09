import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, CloudDrizzle, Moon, CloudMoon, CloudSun } from 'lucide-react';
import { getTimeOfDayColor } from '@/lib/timeOfDayColor';

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

function parseHSL(hslStr: string): { h: number; s: number; l: number } {
  const match = hslStr.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return { h: 200, s: 70, l: 65 };
  return { h: parseInt(match[1]), s: parseInt(match[2]), l: parseInt(match[3]) };
}

function applyWeatherModifier(hsl: { h: number; s: number; l: number }, condition: string | null): { h: number; s: number; l: number } {
  if (!condition) return hsl;
  const lower = condition.toLowerCase();
  let { h, s, l } = hsl;

  if (lower.includes('thunder')) {
    h = Math.min(360, h + 30); // towards purple
    l = Math.max(10, l - 10);
  } else if (lower.includes('rain') || lower.includes('shower') || lower.includes('drizzle')) {
    h = Math.min(360, h + 20); // towards blue
    l = Math.max(10, l - 5);
  } else if (lower.includes('snow')) {
    l = Math.min(90, l + 10);
    s = Math.max(0, s - 20);
  } else if (lower.includes('fog')) {
    s = Math.max(0, s - 30);
    l = Math.min(90, l + 5);
  } else if (lower.includes('cloud') || lower.includes('overcast')) {
    s = Math.max(0, s - 15);
  }
  // clear/sun: keep as-is

  return { h, s, l };
}

interface WeatherBadgeProps {
  temp: number | null;
  condition: string | null;
  hour: number;
  date: Date;
  latitude?: number;
  longitude?: number;
}

const WeatherBadge = ({ temp, condition, hour, date, latitude = 52.37, longitude = 4.9 }: WeatherBadgeProps) => {
  if (temp === null) return null;

  // Build a Date for this specific hour
  const hourDate = new Date(date);
  hourDate.setHours(hour, 0, 0, 0);

  const isNight = hour < 6 || hour >= 21;
  const Icon = getWeatherIcon(condition, isNight);

  // Get time-of-day base color and apply weather modifier
  const baseHSL = parseHSL(getTimeOfDayColor(hourDate, latitude, longitude));
  const modifiedHSL = applyWeatherModifier(baseHSL, condition);
  const { h, s, l } = modifiedHSL;

  const bgColor = `hsl(${h}, ${s}%, ${l}%)`;
  const textColor = l < 40 ? 'white' : 'hsl(220, 20%, 15%)';

  return (
    <div
      className="flex flex-col items-center justify-center w-9 h-9 rounded-full shadow-sm transition-colors duration-500"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
      <span className="text-[9px] font-bold leading-none mt-0.5">{Math.round(temp)}°</span>
    </div>
  );
};

export default WeatherBadge;
