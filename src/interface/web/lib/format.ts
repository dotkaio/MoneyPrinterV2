export function formatDateTime(value: string | null): string {
  if (value === null) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatLabel(value: string): string {
  return value
    .replaceAll(/[._-]+/g, " ")
    .replaceAll(/\b\w/g, (character) => character.toUpperCase());
}

export function truncateIdentifier(value: string): string {
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}
