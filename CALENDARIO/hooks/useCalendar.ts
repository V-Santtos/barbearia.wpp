import { useState, useMemo, useCallback } from 'react';
import type { CalendarDay, CalendarView } from '../types';

export const useCalendar = (initialDate: Date = new Date(), view: CalendarView = 'month') => {
  const [currentDate, setCurrentDate] = useState(initialDate);

  const weekdays = useMemo(() => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], []);

  const monthDays = useMemo<CalendarDay[]>(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const firstDayOfWeek = firstDayOfMonth.getDay();
    const lastDateOfMonth = lastDayOfMonth.getDate();

    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const calendarDays: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Dias do mês anterior (padding)
    for (let i = firstDayOfWeek; i > 0; i--) {
      const date = new Date(year, month - 1, daysInPrevMonth - i + 1);
      calendarDays.push({
        date: date.toLocaleDateString('en-CA'),
        isCurrentMonth: false,
        isToday: false,
      });
    }

    // Dias do mês atual
    for (let i = 1; i <= lastDateOfMonth; i++) {
      const date = new Date(year, month, i);
      calendarDays.push({
        date: date.toLocaleDateString('en-CA'),
        isCurrentMonth: true,
        isToday: date.getTime() === today.getTime(),
      });
    }

    // Dias do próximo mês (padding para 6 linhas)
    const remainingCells = 42 - calendarDays.length;
    for (let i = 1; i <= remainingCells; i++) {
      const date = new Date(year, month + 1, i);
      calendarDays.push({
        date: date.toLocaleDateString('en-CA'),
        isCurrentMonth: false,
        isToday: false,
      });
    }

    return calendarDays;
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    const week = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      week.push({
        date: date.toLocaleDateString('en-CA'),
        isCurrentMonth: date.getMonth() === currentDate.getMonth(),
        isToday: date.getTime() === today.getTime(),
      });
    }

    return week;
  }, [currentDate]);

  const goToNext = useCallback(() => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (view === 'month') newDate.setMonth(prev.getMonth() + 1);
      else if (view === 'week') newDate.setDate(prev.getDate() + 7);
      else if (view === 'day') newDate.setDate(prev.getDate() + 1);
      return newDate;
    });
  }, [view]);

  const goToPrev = useCallback(() => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (view === 'month') newDate.setMonth(prev.getMonth() - 1);
      else if (view === 'week') newDate.setDate(prev.getDate() - 7);
      else if (view === 'day') newDate.setDate(prev.getDate() - 1);
      return newDate;
    });
  }, [view]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const setDate = useCallback((date: Date) => {
    setCurrentDate(date);
  }, []);

  return {
    currentDate,
    days: monthDays,
    weekdays,
    week: weekDays,
    goToNext,
    goToPrev,
    goToToday,
    setDate,
  };
};
