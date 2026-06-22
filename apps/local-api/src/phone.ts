export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) {
    throw new Error("phone is required");
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  if (digits.length < 10 || digits.length > 15) {
    throw new Error("phone must contain 10 to 15 digits");
  }
  return `+${digits}`;
}
