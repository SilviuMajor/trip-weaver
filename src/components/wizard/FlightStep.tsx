import { useState, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { Upload, Pencil, Plus, Check, Plane, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import AirportPicker from '@/components/timeline/AirportPicker';
import AIRPORTS from '@/lib/airports';

export interface FlightDraft {
  flightNumber: string;
  departureLocation: string;
  arrivalLocation: string;
  departureTz: string;
  arrivalTz: string;
  departureTerminal: string;
  arrivalTerminal: string;
  departureTime: string;
  arrivalTime: string;
  date: string;
}

interface FlightStepProps {
  flights: FlightDraft[];
  onChange: (flights: FlightDraft[]) => void;
  startDate: string;
  endDate: string;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const FlightStep = ({ flights, onChange, startDate, endDate }: FlightStepProps) => {
  const [subStep, setSubStep] = useState(flights.length > 0 ? 2 : 0);
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedFlightOptions, setParsedFlightOptions] = useState<any[]>([]);

  // Current flight draft fields
  const [flightNumber, setFlightNumber] = useState('');
  const [departureLocation, setDepartureLocation] = useState('');
  const [arrivalLocation, setArrivalLocation] = useState('');
  const [departureTz, setDepartureTz] = useState('Europe/London');
  const [arrivalTz, setArrivalTz] = useState('Europe/London');
  const [departureTerminal, setDepartureTerminal] = useState('');
  const [arrivalTerminal, setArrivalTerminal] = useState('');
  const [departureTime, setDepartureTime] = useState('10:00');
  const [arrivalTime, setArrivalTime] = useState('13:00');
  const [flightDate, setFlightDate] = useState(startDate);

  const resetFields = () => {
    setFlightNumber('');
    setDepartureLocation('');
    setArrivalLocation('');
    setDepartureTz('Europe/London');
    setArrivalTz('Europe/London');
    setDepartureTerminal('');
    setArrivalTerminal('');
    setDepartureTime('10:00');
    setArrivalTime('13:00');
    setFlightDate(flights.length === 0 ? startDate : endDate);
  };

  const applyParsedFlight = (flight: any) => {
    if (flight.flight_number) setFlightNumber(flight.flight_number);
    if (flight.departure_terminal) setDepartureTerminal(flight.departure_terminal);
    if (flight.arrival_terminal) setArrivalTerminal(flight.arrival_terminal);
    if (flight.departure_time) setDepartureTime(flight.departure_time);
    if (flight.arrival_time) setArrivalTime(flight.arrival_time);
    if (flight.departure_airport) {
      const apt = AIRPORTS.find(a => a.iata === flight.departure_airport.toUpperCase());
      if (apt) {
        setDepartureLocation(`${apt.iata} - ${apt.name}`);
        setDepartureTz(apt.timezone);
      } else {
        setDepartureLocation(flight.departure_airport);
      }
    }
    if (flight.arrival_airport) {
      const apt = AIRPORTS.find(a => a.iata === flight.arrival_airport.toUpperCase());
      if (apt) {
        setArrivalLocation(`${apt.iata} - ${apt.name}`);
        setArrivalTz(apt.timezone);
      } else {
        setArrivalLocation(flight.arrival_airport);
      }
    }
    if (flight.date) setFlightDate(flight.date);
  };

  const handleUpload = async (file: File) => {
    setParsing(true);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke('parse-flight-booking', {
        body: { fileBase64: base64, mimeType: file.type },
      });
      if (error) throw error;

      if (data?.flights?.length > 0) {
        if (data.flights.length === 1) {
          applyParsedFlight(data.flights[0]);
          setSubStep(1);
          toast({ title: 'Extracted flight details — please review ✈️' });
        } else {
          setParsedFlightOptions(data.flights);
        }
      } else {
        toast({ title: 'No flight details found', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Failed to parse', description: err.message, variant: 'destructive' });
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  };

  const handleConfirm = () => {
    const draft: FlightDraft = {
      flightNumber,
      departureLocation,
      arrivalLocation,
      departureTz,
      arrivalTz,
      departureTerminal,
      arrivalTerminal,
      departureTime,
      arrivalTime,
      date: flightDate,
    };
    onChange([...flights, draft]);
    resetFields();

    if (parsedFlightOptions.length > 0) {
      setSubStep(0);
    } else {
      setSubStep(2);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-foreground flex items-center justify-center gap-2">
          <Plane className="h-5 w-5 text-primary" />
          How are you getting there?
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Upload your flight booking or enter details manually</p>
      </div>

      {/* Summary cards for added flights */}
      {flights.length > 0 && (
        <div className="space-y-1.5">
          {flights.map((f, i) => {
            const depShort = f.departureLocation.split(' - ')[0];
            const arrShort = f.arrivalLocation.split(' - ')[0];
            return (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-border p-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">✈️ {f.flightNumber || `${depShort} → ${arrShort}`}</p>
                  <p className="text-xs text-muted-foreground">
                    {depShort} → {arrShort} · {f.departureTime}–{f.arrivalTime}
                    {f.date && ` · ${format(parseISO(f.date), 'd MMM')}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(flights.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Sub-step 0: Entry method */}
      {subStep === 0 && (
        <div className="space-y-3">
          {parsing ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Extracting flight details…</p>
            </div>
          ) : parsedFlightOptions.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">Found {parsedFlightOptions.length} flights — add them one by one:</p>
              {parsedFlightOptions.map((f, i) => {
                const depIata = f.departure_airport?.toUpperCase() || '???';
                const arrIata = f.arrival_airport?.toUpperCase() || '???';
                return (
                  <button
                    key={i}
                    type="button"
                    className="w-full rounded-lg border border-border p-3 text-left hover:bg-accent/50 transition-colors"
                    onClick={() => {
                      applyParsedFlight(f);
                      setParsedFlightOptions(prev => prev.filter((_, j) => j !== i));
                      setSubStep(1);
                    }}
                  >
                    <p className="text-sm font-medium">{f.flight_number || `${depIata} → ${arrIata}`}</p>
                    <p className="text-xs text-muted-foreground">
                      {depIata} → {arrIata} · {f.departure_time}–{f.arrival_time} · {f.date || 'Date TBC'}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
                <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-6 w-6" />
                  <span className="text-xs text-center leading-tight">Upload Booking<br />Confirmation</span>
                </Button>
                <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => { resetFields(); setSubStep(1); }}>
                  <Pencil className="h-6 w-6" />
                  <span className="text-xs text-center leading-tight">Enter<br />Manually</span>
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Sub-step 1: Flight details form */}
      {subStep === 1 && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">Flight number</Label>
            <Input
              value={flightNumber}
              onChange={e => setFlightNumber(e.target.value)}
              placeholder="e.g. BA1234"
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">From</Label>
            <AirportPicker
              value={departureLocation}
              onChange={(apt) => { setDepartureLocation(`${apt.iata} - ${apt.name}`); setDepartureTz(apt.timezone); }}
              placeholder="Departure airport..."
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">To</Label>
            <AirportPicker
              value={arrivalLocation}
              onChange={(apt) => { setArrivalLocation(`${apt.iata} - ${apt.name}`); setArrivalTz(apt.timezone); }}
              placeholder="Arrival airport..."
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Depart</Label>
              <Input type="time" value={departureTime} onChange={e => setDepartureTime(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Arrive</Label>
              <Input type="time" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Date</Label>
            <Input type="date" value={flightDate} onChange={e => setFlightDate(e.target.value)} className="h-9" />
          </div>

          {departureLocation && arrivalLocation && (
            <div className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
              {departureLocation.split(' - ')[0]} → {arrivalLocation.split(' - ')[0]} · {departureTime}–{arrivalTime}
              {flightDate && ` · ${format(parseISO(flightDate), 'd MMM')}`}
            </div>
          )}

          <Button onClick={handleConfirm} disabled={!departureLocation || !arrivalLocation} className="w-full gap-1">
            <Check className="h-4 w-4" /> Confirm Flight
          </Button>
        </div>
      )}

      {/* Sub-step 2: Another flight? */}
      {subStep === 2 && (
        <div className="space-y-4">
          <div className="text-center py-2">
            <p className="text-sm font-medium text-foreground">Flight added ✓</p>
            <p className="text-sm text-muted-foreground">Do you have another flight?</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-16 flex-col gap-1"
              onClick={() => {
                resetFields();
                const lastFlight = flights[flights.length - 1];
                if (lastFlight && flights.length === 1) {
                  setDepartureLocation(lastFlight.arrivalLocation);
                  setArrivalLocation(lastFlight.departureLocation);
                  setDepartureTz(lastFlight.arrivalTz);
                  setArrivalTz(lastFlight.departureTz);
                  setFlightDate(endDate);
                }
                setSubStep(0);
              }}
            >
              <Plus className="h-5 w-5" />
              <span className="text-xs">Add Another</span>
            </Button>
            <Button className="h-16 flex-col gap-1" onClick={() => { /* Stay — main wizard Next advances */ }}>
              <Check className="h-5 w-5" />
              <span className="text-xs">No, continue</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlightStep;
