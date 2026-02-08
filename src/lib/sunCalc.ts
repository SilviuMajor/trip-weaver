/**
 * Simplified solar position calculator based on NOAA formulas.
 * Calculates sunrise, sunset, and solar noon for a given date and location.
 */

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function calculateSunTimes(
  date: Date,
  latitude: number,
  longitude: number
): { sunrise: Date | null; sunset: Date | null; solarNoon: Date } {
  const dayOfYear = getDayOfYear(date);
  const B = (2 * Math.PI / 365) * (dayOfYear - 81);

  // Equation of time (minutes)
  const EoT = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

  // Solar declination (radians)
  const declination = 23.45 * Math.sin(B) * (Math.PI / 180);

  const latRad = latitude * (Math.PI / 180);

  // Solar noon in minutes from midnight UTC
  const solarNoonMin = 720 - 4 * longitude - EoT;

  const baseDate = new Date(date);
  baseDate.setUTCHours(0, 0, 0, 0);

  const solarNoon = new Date(baseDate.getTime() + solarNoonMin * 60000);

  // Hour angle at sunrise/sunset
  const cosHourAngle = -Math.tan(latRad) * Math.tan(declination);

  // Polar night or midnight sun
  if (cosHourAngle > 1) {
    return { sunrise: null, sunset: null, solarNoon };
  }
  if (cosHourAngle < -1) {
    return { sunrise: null, sunset: null, solarNoon };
  }

  const hourAngle = Math.acos(cosHourAngle) * (180 / Math.PI);

  const sunriseMin = solarNoonMin - hourAngle * 4;
  const sunsetMin = solarNoonMin + hourAngle * 4;

  return {
    sunrise: new Date(baseDate.getTime() + sunriseMin * 60000),
    sunset: new Date(baseDate.getTime() + sunsetMin * 60000),
    solarNoon,
  };
}
