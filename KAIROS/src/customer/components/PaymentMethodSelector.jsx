const defaultMethods = [
  { name: "GCash", detail: "Pay with your GCash wallet" },
  { name: "Maya", detail: "Pay with your Maya wallet" },
  { name: "Card", detail: "Visa or Mastercard" },
  { name: "Bank transfer", detail: "Manual bank deposit" },
];

export default function PaymentMethodSelector({ value, onChange, methods = defaultMethods }) {
  return (
    <fieldset>
      <legend className="font-serif text-xl font-bold text-navy">Choose a payment method</legend>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {methods.map((method) => (
          <label key={method.name} className={`cursor-pointer rounded-2xl border p-4 transition ${value === method.name ? "border-primary bg-tint ring-1 ring-primary" : "border-border bg-white hover:border-sky"}`}>
            <input className="sr-only" type="radio" name="payment-method" value={method.name} checked={value === method.name} onChange={() => onChange(method.name)} />
            <span className="flex items-center justify-between font-bold text-navy">{method.name}<span className={`size-4 rounded-full border-4 ${value === method.name ? "border-primary bg-white" : "border-border"}`} /></span>
            <span className="mt-1 block text-sm text-slate">{method.detail}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
