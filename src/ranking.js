export function currentWeeklySeasonId(value = Date.now()) {
  const source = value instanceof Date ? value.getTime() : Number(value);
  const shifted = new Date((Number.isFinite(source) ? source : Date.now()) + 9 * 60 * 60 * 1000);
  const date = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const year = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `weekly-${year}-W${String(week).padStart(2, "0")}`;
}
