/** Returns midnight today in the given IANA timezone as a local Date object */
export function startOfDayInTz(tz: string): Date {
  try {
    // 'en-CA' gives YYYY-MM-DD which we parse as local midnight
    const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: tz });
    return new Date(dateStr + 'T00:00:00');
  } catch {
    // Fallback to local midnight if tz is invalid
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
}

export function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
