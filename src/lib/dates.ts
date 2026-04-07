import { addDays, isBefore, startOfDay } from "date-fns";

export function eachStayDate(checkInDate: Date, checkOutDate: Date) {
  const start = startOfDay(checkInDate);
  const end = startOfDay(checkOutDate);
  const dates: Date[] = [];

  let current = start;
  while (isBefore(current, end)) {
    dates.push(current);
    current = addDays(current, 1);
  }

  return dates;
}
