import { useEffect, useState } from "react";
import { validateProofFile } from "../utils/validators";

export default function ProofOfPaymentUploader({ file, onChange }) {
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreview("");
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  function handleFile(event) {
    const nextFile = event.target.files?.[0];
    const nextError = validateProofFile(nextFile);
    setError(nextError);
    if (!nextError) onChange(nextFile);
  }

  return (
    <div>
      <label className="block cursor-pointer rounded-3xl border-2 border-dashed border-border bg-tint/60 p-6 text-center transition hover:border-primary">
        <input className="sr-only" type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={handleFile} />
        {preview ? <img className="mx-auto max-h-48 rounded-2xl object-contain" src={preview} alt="Payment proof preview" /> : <span className="mx-auto grid size-12 place-items-center rounded-full bg-white text-2xl font-bold text-primary shadow-soft">↑</span>}
        <span className="mt-3 block font-bold text-navy">{file ? file.name : "Upload proof of payment"}</span>
        <span className="mt-1 block text-sm text-slate">JPG, PNG, or PDF · up to 5 MB</span>
      </label>
      {error && <p className="mt-2 text-sm font-semibold text-red-700" role="alert">{error}</p>}
    </div>
  );
}
