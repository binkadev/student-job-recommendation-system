// Calendar labels only: never infer an offset for historical naive timestamps.
export function calendarLabel(value: string) {
  const parts = value.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : parts.length === 2 ? `${parts[1]}/${parts[0]}` : value;
}
