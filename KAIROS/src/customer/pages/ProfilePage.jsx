import { useState } from "react";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { isValidEmail, isValidPhone } from "../utils/validators";

export default function ProfilePage() {
  const { user, updateProfile } = useCustomerAuth();
  const [form, setForm] = useState({ name: user.name, email: user.email, phone: user.phone, password: "" });
  const [message, setMessage] = useState({ type: "", text: "" });

  function submit(event) {
    event.preventDefault();
    if (!form.name.trim()) return setMessage({ type: "error", text: "Enter your full name." });
    if (!isValidEmail(form.email)) return setMessage({ type: "error", text: "Enter a valid email address." });
    if (!isValidPhone(form.phone)) return setMessage({ type: "error", text: "Enter a valid Philippine mobile number." });
    if (form.password && form.password.length < 8) return setMessage({ type: "error", text: "New passwords must be at least 8 characters." });
    updateProfile({ name: form.name, email: form.email, phone: form.phone });
    setMessage({ type: "success", text: "Your profile was updated successfully." });
  }

  return (
    <div className="page-shell">
      <p className="eyebrow">Account settings</p><h1 className="page-title">Your profile</h1><p className="mt-3 text-slate">Keep your contact details current for smooth booking updates.</p>
      <div className="mt-8 grid gap-8 xl:grid-cols-[18rem_1fr]">
        <aside className="h-fit rounded-2xl bg-navy p-5 text-white sm:rounded-3xl sm:p-6"><span className="grid size-16 place-items-center rounded-2xl bg-accent font-serif text-2xl font-black text-navy">{user.name.charAt(0)}</span><h2 className="mt-4 text-xl font-bold">{user.name}</h2><p className="mt-1 break-all text-sm text-white/55">{user.email}</p><p className="mt-8 text-xs font-bold uppercase tracking-widest text-accent">Kai Azul Guest</p></aside>
        <form onSubmit={submit} noValidate className="rounded-2xl border border-border bg-white p-5 shadow-soft sm:rounded-3xl sm:p-8">
          <h2 className="section-title">Personal details</h2>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <label className="filter-label">Full name<input className="form-control" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label className="filter-label">Email address<input type="email" className="form-control" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label className="filter-label">Mobile number<input className="form-control" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
            <label className="filter-label">New password<input type="password" className="form-control" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Leave blank to keep current" /></label>
          </div>
          {message.text && <p className={`mt-5 rounded-xl p-3 text-sm font-bold ${message.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`} role={message.type === "error" ? "alert" : "status"}>{message.text}</p>}
          <button className="mt-6 rounded-xl bg-primary px-6 py-3 font-bold text-white hover:bg-sky" type="submit">Save changes</button>
        </form>
      </div>
    </div>
  );
}
