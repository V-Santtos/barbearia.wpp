import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { Popover as PopoverPrimitive } from "radix-ui";

interface DateFieldProps {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  max?: string;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  dataAutofocus?: boolean;
}

function dateFromIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function DateField({
  id,
  name,
  value,
  onChange,
  max,
  ariaDescribedBy,
  ariaInvalid,
  dataAutofocus,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const selectedDate = useMemo(() => dateFromIso(value), [value]);
  const maxDate = useMemo(() => dateFromIso(max ?? ""), [max]);
  const label = selectedDate
    ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR })
    : "Escolha uma data";

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <input type="hidden" name={name} value={value} />
      <PopoverPrimitive.Trigger asChild>
        <button
          id={id}
          className="ui-date-trigger"
          type="button"
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid || undefined}
          data-autofocus={dataAutofocus ? "true" : undefined}
        >
          <span>{label}</span>
          <CalendarDays aria-hidden="true" size={15} />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className="ui-date-popover"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          aria-label="Escolher data"
        >
          <DayPicker
            mode="single"
            locale={ptBR}
            selected={selectedDate}
            defaultMonth={selectedDate ?? maxDate}
            endMonth={maxDate}
            disabled={maxDate ? { after: maxDate } : undefined}
            onSelect={(nextDate) => {
              if (!nextDate) return;
              onChange(format(nextDate, "yyyy-MM-dd"));
              setOpen(false);
            }}
            components={{
              Chevron: ({ orientation, ...props }) => orientation === "left"
                ? <ChevronLeft aria-hidden="true" size={15} {...props} />
                : <ChevronRight aria-hidden="true" size={15} {...props} />,
            }}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
