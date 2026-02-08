import { calculateSunTimes } from './sunCalc';

interface HSL {
  h: number;
  s: number;
  l: number;
}

const keyframes: { position: number; color: HSL }[] = [
  { position: -1.5, color: { h: 230, s: 40, l: 15 } },  // Pre-dawn – deep indigo
  { position: -0.5, color: { h: 25, s: 80, l: 55 } },   // Sunrise – warm orange
  { position: 0.5, color: { h: 45, s: 70, l: 65 } },    // Morning – soft golden
  { position: 1.0, color: { h: 200, s: 70, l: 65 } },   // Midday – bright sky blue
  { position: 1.5, color: { h: 35, s: 75, l: 55 } },    // Afternoon – warm amber
  { position: 2.5, color: { h: 15, s: 75, l: 50 } },    // Sunset – deep orange-pink
  { position: 3.5, color: { h: 225, s: 45, l: 18 } },   // Night – dark indigo
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpHSL(a: HSL, b: HSL, t: number): HSL {
  return {
    h: lerp(a.h, b.h, t),
    s: lerp(a.s, b.s, t),
    l: lerp(a.l, b.l, t),
  };
}

export function getTimeOfDayColor(
  time: Date,
  latitude: number = 52.37,
  longitude: number = 4.9
): string {
  const { sunrise, sunset, solarNoon } = calculateSunTimes(time, latitude, longitude);

  if (!sunrise || !sunset || !solarNoon) {
    return 'hsl(200, 70%, 65%)';
  }

  const timeMs = time.getTime();
  const sunriseMs = sunrise.getTime();
  const sunsetMs = sunset.getTime();
  const noonMs = solarNoon.getTime();
  const hourMs = 3600000;

  let position: number;

  if (timeMs < sunriseMs - hourMs) {
    position = -1.5;
  } else if (timeMs < sunriseMs + hourMs) {
    const t = (timeMs - (sunriseMs - hourMs)) / (2 * hourMs);
    position = lerp(-1.5, 0.5, t);
  } else if (timeMs < noonMs) {
    const t = (timeMs - (sunriseMs + hourMs)) / (noonMs - sunriseMs - hourMs);
    position = lerp(0.5, 1.0, t);
  } else if (timeMs < sunsetMs - hourMs) {
    const t = (timeMs - noonMs) / (sunsetMs - hourMs - noonMs);
    position = lerp(1.0, 2.5, t);
  } else if (timeMs < sunsetMs + hourMs) {
    const t = (timeMs - (sunsetMs - hourMs)) / (2 * hourMs);
    position = lerp(2.5, 3.5, t);
  } else {
    position = 3.5;
  }

  // Interpolate between keyframes
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (position <= keyframes[i + 1].position) {
      const range = keyframes[i + 1].position - keyframes[i].position;
      const t = Math.max(0, Math.min(1, (position - keyframes[i].position) / range));
      const color = lerpHSL(keyframes[i].color, keyframes[i + 1].color, t);
      return `hsl(${Math.round(color.h)}, ${Math.round(color.s)}%, ${Math.round(color.l)}%)`;
    }
  }

  const last = keyframes[keyframes.length - 1].color;
  return `hsl(${last.h}, ${last.s}%, ${last.l}%)`;
}

export function getTimeOfDayGradient(
  startTime: Date,
  endTime: Date,
  latitude?: number,
  longitude?: number
): string {
  const startColor = getTimeOfDayColor(startTime, latitude, longitude);
  const endColor = getTimeOfDayColor(endTime, latitude, longitude);
  return `linear-gradient(135deg, ${startColor}, ${endColor})`;
}
