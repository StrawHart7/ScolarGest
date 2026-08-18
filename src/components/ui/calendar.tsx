'use client';

import * as React from 'react';
import { DayPicker, type DayPickerProps } from 'react-day-picker';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import 'react-day-picker/style.css';
import { cn } from '@/lib/utils';

export type CalendarProps = DayPickerProps;

export function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col gap-3',
        month: 'flex flex-col gap-3',
        month_caption: 'flex items-center justify-center pt-1 text-body-sm font-semibold text-text-primary',
        nav: 'flex items-center justify-between absolute inset-x-1 top-1',
        button_previous:
          'inline-flex h-7 w-7 items-center justify-center rounded text-text-secondary hover:bg-surface-container-low hover:text-text-primary disabled:opacity-30',
        button_next:
          'inline-flex h-7 w-7 items-center justify-center rounded text-text-secondary hover:bg-surface-container-low hover:text-text-primary disabled:opacity-30',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-9 text-center text-label-md text-text-secondary',
        week: 'flex w-full',
        day: 'h-9 w-9 p-0 text-center text-body-sm',
        day_button:
          'h-9 w-9 rounded-full text-text-primary hover:bg-surface-container-low disabled:pointer-events-none disabled:opacity-30',
        today: '[&>button]:font-semibold [&>button]:text-primary-container',
        selected:
          '[&>button]:bg-primary-container [&>button]:text-primary-on [&>button]:hover:bg-primary-container',
        outside: '[&>button]:text-text-secondary/40',
        disabled: '[&>button]:text-text-secondary/30',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...chevronProps }) =>
          orientation === 'left' ? (
            <ChevronLeft className="h-4 w-4" {...chevronProps} />
          ) : (
            <ChevronRight className="h-4 w-4" {...chevronProps} />
          ),
      }}
      {...props}
    />
  );
}
