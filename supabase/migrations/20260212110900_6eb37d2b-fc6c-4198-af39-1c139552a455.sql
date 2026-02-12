-- Fix old transport entries that lack category and connector links
-- These are entries whose option name starts with transport mode labels
UPDATE entry_options
SET category = 'transfer', category_color = '#6B7280'
WHERE category IS NULL
AND (name ILIKE 'Drive to%' OR name ILIKE 'Walk to%' 
     OR name ILIKE 'Transit to%' OR name ILIKE 'Cycle to%');