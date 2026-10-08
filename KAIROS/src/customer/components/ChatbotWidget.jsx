import { useState } from "react";
import { Link } from "react-router";

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([{ from: "bot", text: "Hi! I’m Haven, your booking concierge. How can I help?" }]);

  function send(event) {
    event.preventDefault();
    if (!message.trim()) {
      setError("Type a message before sending.");
      return;
    }
    setError("");
    setMessages((current) => [...current, { from: "user", text: message }, { from: "bot", text: "I can help with rooms, venues, availability, and reservation status. This demo uses sample replies." }]);
    setMessage("");
  }

  return (
    <div className="fixed bottom-3 right-3 z-50 sm:bottom-5 sm:right-5">
      {open && (
        <section className="mb-3 flex h-[min(24rem,70vh)] w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl sm:w-[min(22rem,calc(100vw-2.5rem))] sm:rounded-3xl" aria-label="Chat with Haven">
          <div className="flex items-center justify-between bg-navy px-5 py-4 text-white">
            <div><p className="font-bold">Ask Haven</p><p className="text-xs text-white/60">Typically replies instantly</p></div>
            <button className="rounded-full p-2 hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Close chat">×</button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-tint/40 p-4">
            {messages.map((item, index) => <p key={`${item.from}-${index}`} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${item.from === "user" ? "ml-auto bg-primary text-white" : "bg-white text-navy shadow-sm"}`}>{item.text}</p>)}
          </div>
          <form className="border-t border-border p-3" onSubmit={send}>
            <div className="flex gap-2"><input aria-label="Chat message" className="min-w-0 flex-1 rounded-xl border border-border px-4 py-2 text-sm outline-none focus:border-primary" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask a question…" /><button className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white" type="submit">Send</button></div>
            {error && <p className="mt-1 text-xs font-bold text-red-700" role="alert">{error}</p>}
          </form>
          <Link className="pb-3 text-center text-xs font-bold text-primary" to="/portal/chat" onClick={() => setOpen(false)}>Open full concierge</Link>
        </section>
      )}
      <button onClick={() => setOpen((current) => !current)} className="ml-auto grid size-14 place-items-center rounded-full bg-primary text-lg font-black text-white shadow-xl transition hover:bg-sky focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" aria-label="Open booking concierge">
        {open ? "×" : "H"}
      </button>
    </div>
  );
}
