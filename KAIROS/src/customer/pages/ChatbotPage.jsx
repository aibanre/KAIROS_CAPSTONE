import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createReservationHold } from "../api/reservationsApi";
import { clearHistory, getHistory, sendMessage } from "../api/chatbotApi";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { clearPendingChatbotProposal, getPendingChatbotProposal, isReservationConfirmation, savePendingChatbotProposal } from "../utils/chatbotReservation";
import { useResortInfo } from "../../public/context/ResortInfoContext";
import ChatbotReservationReview from "../../shared/chatbot/ChatbotReservationReview";

const suggestions = ["I want to make a reservation", "What cottages do you have?", "How much is the Conference Hall?", "What's the status of my reservation?"];
const errorText = (error) => error?.status === 429 ? "You're sending messages too fast. Please try again shortly." : error?.status === 503 ? "The assistant is unavailable right now. Please try again later." : error?.message || "Something went wrong. Please try again.";

function safeLinkTarget(value) {
  try {
    const url = new URL(value, window.location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function renderInline(text, keyPrefix) {
  const tokenPattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|`[^`]+`|\[(?:[^\]]+)\]\((?:[^)]+)\)|https?:\/\/[^\s)]+|\/(?:portal|rooms-and-venues|booking-information|book|payment)(?:\/[^\s)]*)?)/g;
  const parts = String(text).split(tokenPattern);
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (!part) return null;
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return <strong key={key} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) return <em key={key}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={key} className="rounded bg-slate-100 px-1 py-0.5 text-[0.9em]">{part.slice(1, -1)}</code>;
    }
    const markdownLink = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    const linkText = markdownLink?.[1] || part;
    const linkTarget = markdownLink?.[2]
      || (/^https?:\/\//i.test(part) || /^\/(?:portal|rooms-and-venues|booking-information|book|payment)(?:\/|$)/.test(part) ? part : null);
    const href = linkTarget ? safeLinkTarget(linkTarget) : null;
    if (href) {
      const external = new URL(href).origin !== window.location.origin;
      return <a key={key} href={href} className="font-semibold text-primary underline underline-offset-2" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{linkText}</a>;
    }
    return part;
  });
}

function ChatMessage({ content }) {
  const lines = String(content ?? "").split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let list = [];
  let listType = "";
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", lines: paragraph });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push({ type: listType, items: list });
      list = [];
      listType = "";
    }
  };

  lines.forEach((line) => {
    const bullet = line.match(/^\s*(?:[-*+•]|_)\s+(.+)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (bullet || numbered) {
      flushParagraph();
      const nextType = bullet ? "ul" : "ol";
      if (listType && listType !== nextType) flushList();
      listType = nextType;
      list.push((bullet || numbered)[1]);
      return;
    }
    flushList();
    if (!line.trim()) {
      flushParagraph();
      return;
    }
    paragraph.push(line);
  });
  flushParagraph();
  flushList();

  return <div className="space-y-3">
    {blocks.map((block, index) => block.type === "paragraph"
      ? <p key={index}>{block.lines.map((line, lineIndex) => <span key={lineIndex}>{lineIndex > 0 ? <br /> : null}{renderInline(line, `${index}-${lineIndex}`)}</span>)}</p>
      : block.type === "ul"
        ? <ul key={index} className="list-disc space-y-1 pl-5">{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, `${index}-${itemIndex}`)}</li>)}</ul>
        : <ol key={index} className="list-decimal space-y-1 pl-5">{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, `${index}-${itemIndex}`)}</li>)}</ol>)}
  </div>;
}

export default function ChatbotPage() {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const { resort_name: resortName } = useResortInfo();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [bookingProposal, setBookingProposal] = useState(null);
  const [paymentReservationId, setPaymentReservationId] = useState(null);
  const [bookingError, setBookingError] = useState("");
  const [existingHolds, setExistingHolds] = useState([]);
  const [confirmingBooking, setConfirmingBooking] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { getHistory().then((data) => setMessages(data.messages || [])).catch((err) => setError(errorText(err))); }, []);
  useEffect(() => {
    setBookingProposal(getPendingChatbotProposal(user?.id));
  }, [user?.id]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function confirmReservation(proposal = bookingProposal, confirmationText = "I confirm. Please place the hold.") {
    if (!proposal || confirmingBooking) return;
    setMessages((current) => [...current, { role: "user", content: confirmationText }]);
    setConfirmingBooking(true);
    setBookingError("");
    setExistingHolds([]);
    try {
      const hold = await createReservationHold(proposal.details);
      sessionStorage.setItem("kairos_reservation_hold", JSON.stringify(hold));
      clearPendingChatbotProposal(user?.id);
      setBookingProposal(null);
      setPaymentReservationId(String(hold.reservation_id));
      setMessages((current) => [...current, { role: "assistant", content: `Your 15-minute hold is ready. Booking reference: ${hold.booking_reference}. Use the payment link below to continue.` }]);
    } catch (holdError) {
      if ([401, 403].includes(holdError.status)) {
        navigate("/login");
      } else if (holdError.status === 429) {
        setExistingHolds(holdError.existingHolds || []);
        setBookingError("You have reached the limit for reservations in progress. Continue an existing reservation below.");
      } else if (holdError.status === 409) {
        clearPendingChatbotProposal(user?.id);
        setBookingProposal(null);
        setBookingError("That option is no longer available. Ask me to check another date or option.");
      } else {
        setBookingError("We could not create the hold. Please try again.");
      }
    } finally {
      setConfirmingBooking(false);
    }
  }

  async function send(event, value) {
    event?.preventDefault();
    const text = (value ?? message).trim();
    if (!text || loading || confirmingBooking) return;
    setError(""); setMessage("");
    if (bookingProposal && isReservationConfirmation(text)) {
      await confirmReservation(bookingProposal, text);
      return;
    }
    if (bookingProposal) {
      clearPendingChatbotProposal(user?.id);
      setBookingProposal(null);
      setPaymentReservationId(null);
      setBookingError("");
      setExistingHolds([]);
    }
    setLoading(true);
    setMessages((current) => [...current, { role: "user", content: text }]);
    try {
      const data = await sendMessage(text);
      if (data.booking_proposal) {
        savePendingChatbotProposal(user?.id, data.booking_proposal);
        setBookingProposal(data.booking_proposal);
        setPaymentReservationId(null);
        setBookingError("");
      }
      setMessages((current) => [...current, { role: "assistant", content: data.message }]);
    } catch (err) { setError(errorText(err)); } finally { setLoading(false); }
  }
  async function clear() {
    try {
      await clearHistory();
      setMessages([]);
      setError("");
      clearPendingChatbotProposal(user?.id);
      setBookingProposal(null);
      setPaymentReservationId(null);
      setBookingError("");
      setExistingHolds([]);
    } catch (err) { setError(errorText(err)); }
  }

  return <div className="page-shell"><div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border bg-white shadow-soft sm:rounded-[2rem]">
    <header className="flex items-start justify-between bg-navy p-5 text-white sm:p-8"><div><p className="text-xs font-bold uppercase tracking-widest text-accent">Virtual concierge</p><h1 className="mt-2 font-serif text-3xl font-bold">Kai Azul Concierge</h1><p className="mt-2 text-sm text-white/65">Grounded answers about {resortName}.</p></div><button onClick={clear} className="rounded-lg border border-white/30 px-3 py-2 text-xs font-bold hover:bg-white/10">Clear conversation</button></header>
    <div className="h-[28rem] space-y-4 overflow-y-auto bg-tint/50 p-4 sm:p-8">{messages.length === 0 && <p className="text-sm text-navy/70">Ask about rooms, venues, packages, availability, payments, or your reservation.</p>}{messages.map((item, index) => <div key={`${item.role}-${index}`} className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[80%] sm:rounded-3xl sm:px-5 sm:py-4 sm:text-base sm:leading-7 ${item.role === "user" ? "ml-auto whitespace-pre-wrap bg-primary text-white" : "bg-white text-navy shadow-sm"}`}>{item.role === "assistant" ? <ChatMessage content={item.content} /> : item.content}</div>)}    {bookingProposal || paymentReservationId || bookingError || existingHolds.length ? <ChatbotReservationReview proposal={bookingProposal} paymentReservationId={paymentReservationId} confirming={confirmingBooking} error={bookingError} existingHolds={existingHolds} onConfirm={() => confirmReservation()} /> : null}{loading && <p className="text-sm text-navy/60">Kai Azul Concierge is thinking…</p>}<div ref={endRef} /></div>
    <div className="border-t border-border p-4 sm:p-6"><div className="mb-4 flex flex-wrap gap-2">{suggestions.map((item) => <button key={item} disabled={loading || confirmingBooking} onClick={() => send(null, item)} className="rounded-full border border-border px-3 py-2 text-xs font-bold text-primary hover:bg-tint disabled:opacity-50">{item}</button>)}</div><form onSubmit={send}><div className="grid gap-3 sm:grid-cols-[1fr_auto]"><input maxLength={1000} className="min-w-0 flex-1 rounded-xl border border-border px-5 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" value={message} onChange={(event) => setMessage(event.target.value)} placeholder={bookingProposal ? "Reply confirm or tell me what to change…" : "Ask about your stay…"} disabled={loading || confirmingBooking} /><button disabled={loading || confirmingBooking} className="rounded-xl bg-primary px-6 py-3 font-bold text-white hover:bg-sky disabled:opacity-50" type="submit">Send</button></div>{error && <p className="mt-2 text-sm font-bold text-red-700" role="alert">{error}</p>}</form></div>
  </div></div>;
}
