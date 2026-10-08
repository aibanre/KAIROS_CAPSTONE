import { useState } from "react";

export default function ChatbotPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([
    { from: "bot", text: "Welcome to Harbor & Haven. I’m Haven, your virtual concierge. What can I help you plan?" },
  ]);
  const suggestions = ["Which room is best for a family?", "Do you have wedding venues?", "How do I track my reservation?"];

  function send(text) {
    const next = typeof text === "string" ? text : message;
    if (!next.trim()) {
      setError("Type a message before sending.");
      return;
    }
    setError("");
    const lower = next.toLowerCase();
    let reply = "I can help you compare rooms, explore venues, or understand the booking process. All availability shown here is sample data.";
    if (lower.includes("family")) reply = "Our Family Pool Villa sleeps up to five guests and includes two queen beds, two bathrooms, and lagoon pool access.";
    if (lower.includes("wedding") || lower.includes("venue")) reply = "The Grand Ballroom hosts up to 250 guests, while the Cliffside Pavilion is ideal for sunset celebrations of up to 120.";
    if (lower.includes("track")) reply = "Open Track in the navigation and enter your reference number plus the booking email. Try HB-2026-1048 with maria@example.com.";
    setMessages((current) => [...current, { from: "user", text: next }, { from: "bot", text: reply }]);
    setMessage("");
  }

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border bg-white shadow-soft sm:rounded-[2rem]">
        <header className="bg-navy p-5 text-white sm:p-8"><p className="text-xs font-bold uppercase tracking-widest text-accent">Virtual concierge</p><h1 className="mt-2 font-serif text-3xl font-bold">Ask Haven</h1><p className="mt-2 text-sm text-white/65">Instant sample answers, any time of day.</p></header>
        <div className="h-[24rem] space-y-4 overflow-y-auto bg-tint/50 p-4 sm:h-[28rem] sm:p-8">{messages.map((item, index) => <div key={`${item.from}-${index}`} className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[80%] sm:rounded-3xl sm:px-5 sm:py-4 sm:text-base sm:leading-7 ${item.from === "user" ? "ml-auto bg-primary text-white" : "bg-white text-navy shadow-sm"}`}>{item.text}</div>)}</div>
        <div className="border-t border-border p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap gap-2">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => send(suggestion)} className="rounded-full border border-border px-3 py-2 text-xs font-bold text-primary hover:bg-tint">{suggestion}</button>)}</div>
          <form onSubmit={(event) => { event.preventDefault(); send(message); }}><div className="grid gap-3 sm:grid-cols-[1fr_auto]"><input className="min-w-0 flex-1 rounded-xl border border-border px-5 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask about your stay…" /><button className="rounded-xl bg-primary px-6 py-3 font-bold text-white hover:bg-sky" type="submit">Send</button></div>{error && <p className="mt-2 text-sm font-bold text-red-700" role="alert">{error}</p>}</form>
        </div>
      </div>
    </div>
  );
}
