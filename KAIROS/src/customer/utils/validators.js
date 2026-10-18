export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidPhone(value) {
  return /^(?:\+63|0)9\d{9}$/.test(value.replace(/\s/g, ""));
}

export function limitPhoneInput(value) {
  const digits = value.replace(/\D/g, "");
  const localNumber = digits.length === 12 && digits.startsWith("63")
    ? `0${digits.slice(2)}`
    : digits;
  return localNumber.slice(0, 11);
}

export function validateProofFile(file) {
  if (!file) return "Choose an image.";
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "Use a JPG, PNG, or WebP file.";
  if (file.size > 5 * 1024 * 1024) return "The file must be 5 MB or smaller.";
  return "";
}
