import { useState, useRef, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { ChevronsUpDown } from 'lucide-react';
import { searchAirports, type Airport } from '@/lib/airports';
import { cn } from '@/lib/utils';

interface AirportPickerProps {
  value: string;
  onChange: (airport: Airport) => void;
  placeholder?: string;
}

const AirportPicker = ({ value, onChange, placeholder = 'Search airport...' }: AirportPickerProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = searchAirports(query || value?.split(' - ')[0] || '');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-left font-normal h-10"
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 z-50 bg-popover" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by code, city, or name..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No airports found.</CommandEmpty>
            <CommandGroup>
              {results.map((airport) => (
                <CommandItem
                  key={airport.iata}
                  value={airport.iata}
                  onSelect={() => {
                    onChange(airport);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{airport.iata}</span>
                      <span className="text-sm">{airport.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {airport.city}, {airport.country}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default AirportPicker;
