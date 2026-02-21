export function toTitleLabel(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatTrackLabel(track: string) {
  return track === "b2b" ? "B2B SaaS PM" : "B2C Consumer PM";
}
