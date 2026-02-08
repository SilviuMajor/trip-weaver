interface TimeSlotGridProps {
  startHour: number;
  endHour: number;
  pixelsPerHour: number;
  date: Date;
  onClickSlot?: (time: Date) => void;
}

const TimeSlotGrid = ({ startHour, endHour, pixelsPerHour, date, onClickSlot }: TimeSlotGridProps) => {
  const hours: number[] = [];
  for (let h = startHour; h < endHour; h++) {
    hours.push(h);
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onClickSlot) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutesFromStart = (y / pixelsPerHour) * 60;
    const totalMinutes = startHour * 60 + minutesFromStart;
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round((totalMinutes % 60) / 15) * 15;

    const time = new Date(date);
    time.setHours(h, m, 0, 0);
    onClickSlot(time);
  };

  return (
    <div className="absolute inset-0" onClick={handleClick}>
      {hours.map(hour => (
        <div
          key={hour}
          className="absolute left-0 right-0 border-t border-border/30"
          style={{ top: (hour - startHour) * pixelsPerHour }}
        >
          <span className="absolute -top-2.5 left-0 select-none text-[10px] font-medium text-muted-foreground/50">
            {String(hour).padStart(2, '0')}:00
          </span>
        </div>
      ))}
    </div>
  );
};

export default TimeSlotGrid;
