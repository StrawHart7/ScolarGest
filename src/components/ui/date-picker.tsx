'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from './popover';
import { Calendar } from './calendar';

export interface DatePickerProps {
  id?: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
}

function parseIsoDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Replaces the native `<input type="date">` (inconsistent OS-level picker UI)
 * with a styled trigger + popover calendar. Submits as a plain ISO
 * (yyyy-MM-dd) hidden input, so it drops into existing FormData-based Server
 * Actions unchanged — form validation stays server-side (Zod).
 */
export function DatePicker({ id, name, defaultValue, placeholder, disabled }: DatePickerProps) {
  const [date, setDate] = React.useState<Date | undefined>(parseIsoDate(defaultValue));
  const [open, setOpen] = React.useState(false);
  const iso = date ? format(date, 'yyyy-MM-dd') : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <input type="hidden" name={name} value={iso} />
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center gap-2 rounded border border-surface-border bg-surface-container-lowest px-3 text-left text-body-md text-text-primary transition-colors hover:border-primary-container/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/20 disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
          <span className={cn(!date && 'text-text-secondary/60')}>
            {date ? format(date, 'dd MMMM yyyy', { locale: fr }) : (placeholder ?? 'Sélectionner une date')}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          locale={fr}
          onSelect={(next) => {
            setDate(next);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
