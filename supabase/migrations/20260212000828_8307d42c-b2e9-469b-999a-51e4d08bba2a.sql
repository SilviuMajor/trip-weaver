ALTER TABLE trips RENAME COLUMN timezone TO home_timezone;
ALTER TABLE trips ALTER COLUMN home_timezone SET DEFAULT 'Europe/London';