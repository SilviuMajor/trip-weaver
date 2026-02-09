import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Plane } from 'lucide-react';
import { cn } from '@/lib/utils';
import AirportPicker from '@/components/timeline/AirportPicker';
import type { Airport } from '@/lib/airports';

export interface FlightDraft {
  departureLocation: string;
  arrivalLocation: string;
  departureTz: string;
  arrivalTz: string;
  departureTerminal: string;
  arrivalTerminal: string;
  departureTime: string;
  arrivalTime: string;
}

interface DateStepProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  datesUnknown: boolean;
  onDatesUnknownChange: (v: boolean) => void;
  durationDays: number;
  onDurationDaysChange: (v: number) => void;
  outboundFlight: FlightDraft | null;
  onOutboundFlightChange: (v: FlightDraft | null) => void;
  returnFlight: FlightDraft | null;
  onReturnFlightChange: (v: FlightDraft | null) => void;
}

const emptyFlight = (): FlightDraft => ({
  departureLocation: '',
  arrivalLocation: '',
  departureTz: 'Europe/London',
  arrivalTz: 'Europe/Amsterdam',
  departureTerminal: '',
  arrivalTerminal: '',
  departureTime: '10:00',
  arrivalTime: '13:00',
});

const DateStep = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  datesUnknown,
  onDatesUnknownChange,
  durationDays,
  onDurationDaysChange,
  outboundFlight,
  onOutboundFlightChange,
  returnFlight,
  onReturnFlightChange,
}: DateStepProps) => {
  const [flightsOpen, setFlightsOpen] = useState(!!outboundFlight);
  const [showOutbound, setShowOutbound] = useState(!!outboundFlight);
  const [showReturn, setShowReturn] = useState(!!returnFlight);

  const handleToggleOutbound = (checked: boolean) => {
    setShowOutbound(checked);
    onOutboundFlightChange(checked ? (outboundFlight ?? emptyFlight()) : null);
  };

  const handleToggleReturn = (checked: boolean) => {
    setShowReturn(checked);
    if (checked) {
      // Pre-fill return with reversed airports
      if (outboundFlight) {
        onReturnFlightChange({
          ...emptyFlight(),
          departureLocation: outboundFlight.arrivalLocation,
          arrivalLocation: outboundFlight.departureLocation,
          departureTz: outboundFlight.arrivalTz,
          arrivalTz: outboundFlight.departureTz,
        });
      } else {
        onReturnFlightChange(emptyFlight());
      }
    } else {
      onReturnFlightChange(null);
    }
  };

  const updateOutbound = (patch: Partial<FlightDraft>) => {
    if (outboundFlight) onOutboundFlightChange({ ...outboundFlight, ...patch });
  };

  const updateReturn = (patch: Partial<FlightDraft>) => {
    if (returnFlight) onReturnFlightChange({ ...returnFlight, ...patch });
  };

  const handleOutboundDepartureAirport = (airport: Airport) => {
    updateOutbound({ departureLocation: `${airport.iata} - ${airport.name}`, departureTz: airport.timezone });
  };

  const handleOutboundArrivalAirport = (airport: Airport) => {
    updateOutbound({ arrivalLocation: `${airport.iata} - ${airport.name}`, arrivalTz: airport.timezone });
  };

  const handleReturnDepartureAirport = (airport: Airport) => {
    updateReturn({ departureLocation: `${airport.iata} - ${airport.name}`, departureTz: airport.timezone });
  };

  const handleReturnArrivalAirport = (airport: Airport) => {
    updateReturn({ arrivalLocation: `${airport.iata} - ${airport.name}`, arrivalTz: airport.timezone });
  };

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold">When are you going?</h2>
      <p className="mb-6 text-sm text-muted-foreground">Set your travel dates</p>

      <div className="mb-6 flex items-center gap-3">
        <Switch
          id="dates-unknown"
          checked={datesUnknown}
          onCheckedChange={onDatesUnknownChange}
        />
        <Label htmlFor="dates-unknown" className="cursor-pointer text-sm">
          I don't know when yet
        </Label>
      </div>

      {datesUnknown ? (
        <div className="space-y-2">
          <Label>How many days?</Label>
          <Input
            type="number"
            min={1}
            max={30}
            value={durationDays}
            onChange={(e) => onDurationDaysChange(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
          />
          <p className="text-xs text-muted-foreground">
            You can set exact dates later
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Start date</Label>
            <Input type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>End date</Label>
            <Input type="date" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} />
          </div>
        </div>
      )}

      {/* Collapsible flights section */}
      <Collapsible open={flightsOpen} onOpenChange={setFlightsOpen} className="mt-6">
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50">
          <span className="flex items-center gap-2">
            <Plane className="h-4 w-4" />
            Add flights (optional)
          </span>
          <ChevronDown className={cn('h-4 w-4 transition-transform', flightsOpen && 'rotate-180')} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-4">
          {/* Outbound */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch checked={showOutbound} onCheckedChange={handleToggleOutbound} />
              <Label className="text-sm">Outbound flight</Label>
            </div>
            {showOutbound && outboundFlight && (
              <div className="space-y-3 rounded-lg border border-border/40 bg-card/50 p-3">
                <div className="space-y-2">
                  <Label className="text-xs">From</Label>
                  <AirportPicker value={outboundFlight.departureLocation} onChange={handleOutboundDepartureAirport} placeholder="Departure airport..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">To</Label>
                  <AirportPicker value={outboundFlight.arrivalLocation} onChange={handleOutboundArrivalAirport} placeholder="Arrival airport..." />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Depart</Label>
                    <Input type="time" value={outboundFlight.departureTime} onChange={(e) => updateOutbound({ departureTime: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Arrive</Label>
                    <Input type="time" value={outboundFlight.arrivalTime} onChange={(e) => updateOutbound({ arrivalTime: e.target.value })} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Return */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch checked={showReturn} onCheckedChange={handleToggleReturn} />
              <Label className="text-sm">Return flight</Label>
            </div>
            {showReturn && returnFlight && (
              <div className="space-y-3 rounded-lg border border-border/40 bg-card/50 p-3">
                <div className="space-y-2">
                  <Label className="text-xs">From</Label>
                  <AirportPicker value={returnFlight.departureLocation} onChange={handleReturnDepartureAirport} placeholder="Departure airport..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">To</Label>
                  <AirportPicker value={returnFlight.arrivalLocation} onChange={handleReturnArrivalAirport} placeholder="Arrival airport..." />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Depart</Label>
                    <Input type="time" value={returnFlight.departureTime} onChange={(e) => updateReturn({ departureTime: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Arrive</Label>
                    <Input type="time" value={returnFlight.arrivalTime} onChange={(e) => updateReturn({ arrivalTime: e.target.value })} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default DateStep;
