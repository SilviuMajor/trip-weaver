const getWeatherEmoji = (condition: string | null, isNight: boolean): string => {
  if (!condition) return isNight ? '🌙' : '☀️';
  const lower = condition.toLowerCase();
  if (lower.includes('thunder')) return '⛈️';
  if (lower.includes('snow')) return '🌨️';
  if (lower.includes('fog')) return '🌫️';
  if (lower.includes('drizzle')) return isNight ? '🌧️' : '🌦️';
  if (lower.includes('rain') || lower.includes('shower')) return '🌧️';
  if (lower.includes('partly') || lower.includes('cloud')) return isNight ? '☁️' : '⛅';
  if (lower.includes('overcast')) return '☁️';
  if (lower.includes('clear')) return isNight ? '🌙' : '☀️';
  return isNight ? '🌙' : '☀️';
};

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
  const emoji = getWeatherEmoji(condition, isNight);

  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold whitespace-nowrap">
      <span className="text-sm leading-none">{emoji}</span>
      <span className="text-muted-foreground">{Math.round(temp)}°</span>
    </span>
  );
};

export default WeatherBadge;
