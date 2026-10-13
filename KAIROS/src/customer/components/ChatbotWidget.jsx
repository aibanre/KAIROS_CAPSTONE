import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import BrandLogo from "./BrandLogo";
import { clearHistory, getHistory, sendMessage } from "../api/chatbotApi";
import { useResortInfo } from "../../public/context/ResortInfoContext";

const starters = ["What cottages do you have?", "How much is the Conference Hall?", "What's the status of my reservation?"];

function errorText(error) {
  if (error?.status === 429) return "You're sending messages too fast. Please try again shortly.";
  if (error?.status === 503) return "The assistant is unavailable right now. Please try again later.";
  return error?.message || "Something went wrong. Please try again.";
}

export default function ChatbotWidget() {
  const { resort_name: resortName } = useResortInfo();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const endRef = useRef(null);

  useEffect(() => { if (open) getHistory().then((data) => setMessages(data.messages || [])).catch((err) => setError(errorText(err))); }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function send(event, suggested) {
    event?.preventDefault();
    const text = (suggested ?? message).trim();
    if (!text || loading) return;
    setError(""); setLoading(true); setMessage("");
    setMessages((current) => [...current, { role: "user", content: text }]);
    try {
      const data = await sendMessage(text);
      setMessages((current) => [...current, { role: "assistant", content: data.message }]);
    } catch (err) { setError(errorText(err)); } finally { setLoading(false); }
  }

  async function clear() {
    try { await clearHistory(); setMessages([]); setError(""); } catch (err) { setError(errorText(err)); }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-5 sm:right-5">
      {open && <section className="mb-3 flex h-[min(30rem,75vh)] w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl sm:w-[min(24rem,calc(100vw-2.5rem))]" aria-label={`Chat with ${resortName || "the resort"}`}>
        <div className="flex items-center justify-between bg-navy px-5 py-4 text-white"><div className="flex items-center gap-3"><BrandLogo size="sm" collapsed linkTo={null} /><div><p className="font-bold">Kai Azul Concierge</p><p className="text-xs text-white/60">{resortName || "Resort"} virtual concierge</p></div></div><div className="flex gap-1"><button className="rounded px-2 text-xs hover:bg-white/10" onClick={clear}>Clear</button><button className="rounded-full p-2 hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Close chat">×</button></div></div>
        <div className="flex-1 space-y-3 overflow-y-auto bg-tint/40 p-4">{messages.length === 0 && <div className="space-y-2"><p className="text-sm text-navy/70">How can I help with your {resortName || "resort"} stay?</p>{starters.map((item) => <button key={item} onClick={() => send(null, item)} className="block rounded-full border border-border bg-white px-3 py-2 text-left text-xs font-bold text-primary">{item}</button>)}</div>}{messages.map((item, index) => <p key={`${item.role}-${index}`} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${item.role === "user" ? "ml-auto bg-primary text-white" : "bg-white text-navy shadow-sm"}`}>{item.content}</p>)}{loading && <p className="text-sm text-navy/60">Kai Azul Concierge is thinking…</p>}<div ref={endRef} /></div>
        <form className="border-t border-border p-3" onSubmit={send}><div className="flex gap-2"><input aria-label="Chat message" maxLength={1000} className="min-w-0 flex-1 rounded-xl border border-border px-4 py-2 text-sm outline-none focus:border-primary" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask a question…" disabled={loading} /><button disabled={loading} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50" type="submit">Send</button></div>{error && <p className="mt-1 text-xs font-bold text-red-700" role="alert">{error}</p>}</form>
        <Link className="pb-3 text-center text-xs font-bold text-primary" to="/portal/chat" onClick={() => setOpen(false)}>Open full concierge</Link>
      </section>}
      <button onClick={() => setOpen((current) => !current)} className="ml-auto grid h-12 w-12 place-items-center rounded-full bg-primary text-lg font-black text-white shadow-xl transition hover:bg-sky sm:size-14" aria-label="Open booking concierge">{open ? "×" : <BrandLogo size="sm" collapsed linkTo={null} />}</button>
    </div>
  );
}
