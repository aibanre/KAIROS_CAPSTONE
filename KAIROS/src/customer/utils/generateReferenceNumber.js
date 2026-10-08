export default function generateReferenceNumber() {
  const year = new Date().getFullYear();
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `HH-${year}-${suffix}`;
}
