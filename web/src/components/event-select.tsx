import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * The event picker appears in the shell header and in the empty state of screens
 * that need a selection. One component keeps the wording and behaviour aligned.
 */
export function EventSelect({
  events,
  value,
  onValueChange,
  label,
  placeholder = "Chọn sự kiện",
  className,
  disabled,
}: {
  events: Array<{ id: string; name: string }>;
  value?: string | null;
  onValueChange: (eventId: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value ?? ""}
      onValueChange={(next) => next && onValueChange(next)}
      disabled={disabled || events.length === 0}
    >
      <SelectTrigger aria-label={label} className={className}>
        <SelectValue placeholder={events.length === 0 ? "Chưa có sự kiện" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {events.map((event) => (
          <SelectItem key={event.id} value={event.id}>
            {event.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
