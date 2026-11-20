const dateTime = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

const dateOnly = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeZone: "Asia/Kolkata",
});

/** Timestamps are shown in Indian Standard Time, labelled as such. */
export function formatDateTime(value: Date): string {
  return `${dateTime.format(value)} IST`;
}

export function formatDate(value: Date): string {
  return dateOnly.format(value);
}
