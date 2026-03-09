import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(duration);

/**
 * Format a date string to a specified pattern
 *
 * @param date input date string
 * @param pattern output date pattern
 * @param fallbackValue value to return if date is invalid or fails to format
 * @param offsetTimezone whether to offset UTC to the user's timezone
 * @returns formatted date or fallbackValue if invalid
 */
export const FormatDate = (
  date: string,
  pattern = "M/D/YYYY",
  fallbackValue = null,
  offsetTimezone = true
): string => {
  const dateObj = offsetTimezone ? dayjs(date) : dayjs.utc(date);

  if (!dateObj?.isValid()) {
    return fallbackValue;
  }

  try {
    return dateObj?.format(pattern);
  } catch (e) {
    return fallbackValue;
  }
};

/**
 * Parses a number of seconds into a string formatted as "mm:ss".
 *
 * @note Supports up to 59 minutes and 59 seconds.
 * @param seconds The number of seconds to convert.
 * @returns A string formatted as "mm:ss".
 */
export const secondsToMinuteString = (seconds: number) =>
  dayjs.duration(seconds, "seconds").format("mm:ss");
