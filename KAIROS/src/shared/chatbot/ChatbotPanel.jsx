import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import BrandLogo from "../../customer/components/BrandLogo";
import { createReservationHold } from "../../customer/api/reservationsApi";
import { clearHistory, getHistory, sendGuestMessage, sendMessage } from "../../customer/api/chatbotApi";
import { useCustomerAuth } from "../../customer/context/CustomerAuthContext";
import { clearPendingChatbotProposal, getPendingChatbotProposal, isReservationConfirmation, savePendingChatbotProposal } from "../../customer/utils/chatbotReservation";
import { useResortInfo } from "../../public/context/ResortInfoContext";
import ChatbotMessageContent from "./ChatbotMessageContent";
import ChatbotReservationReview from "./ChatbotReservationReview";
import "./chatbot.css";

const CUSTOMER_STARTERS = ["I want to make a reservation", "What cottages do you have?", "How much is the Conference Hall?", "What's the status of my reservation?"];
const GUEST_STARTERS = ["What rooms are available?", "How do I pay?", "What are the check-in times?", "Tell me about the Conference Hall packages"];
const GUEST_STORAGE_KEY = "kairos_guest_chat";
const MAX_INPUT_LENGTH = 500;

function errorText(error) {
  if (error?.status === 429) return "The assistant is busy, please try again in a minute.";
  if (error?.status === 503) return "The assistant is unavailable right now.";
  return error?.message || "Something went wrong. Please try again.";
}

function loadGuestMessages() {
  try {
    const value = JSON.parse(sessionStorage.getItem(GUEST_STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item) => item?.role && typeof item.content === "string").slice(-8) : [];
  } catch {
    return [];
  }
}

export default function ChatbotPanel({ portal = false }) {
  const { isAuthenticated, user } = useCustomerAuth();
  const navigate = useNavigate();
  const { resort_name: resortName } = useResortInfo();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [messages, setMessages] = useState([]);
  const [bookingProposal, setBookingProposal] = useState(null);
  const [paymentReservationId, setPaymentReservationId] = useState(null);
  const [bookingError, setBookingError] = useState("");
  const [existingHolds, setExistingHolds] = useState([]);
  const [confirmingBooking, setConfirmingBooking] = useState(false);
  const endRef = useRef(null);
  const launcherRef = useRef(null);
  const panelRef = useRef(null);
  const wasAuthenticated = useRef(isAuthenticated);

  const guest = !isAuthenticated;
  const starters = guest ? GUEST_STARTERS : CUSTOMER_STARTERS;

  useEffect(() => {
    if (sessionStorage.getItem("kairos_chatbot_tooltip_seen")) return undefined;
    const timer = window.setTimeout(() => {
      sessionStorage.setItem("kairos_chatbot_tooltip_seen", "1");
      setShowTooltip(true);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (wasAuthenticated.current !== isAuthenticated) {
      setMessages(isAuthenticated ? [] : loadGuestMessages());
      setError("");
      setMessage("");
      setBookingProposal(null);
      setPaymentReservationId(null);
      wasAuthenticated.current = isAuthenticated;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!open) return undefined;
    if (guest) {
      setMessages(loadGuestMessages());
      return undefined;
    }
    setBookingProposal(getPendingChatbotProposal(user?.id));
    getHistory().then((data) => setMessages(data.messages || [])).catch((err) => setError(errorText(err)));
    return undefined;
  }, [open, guest, user?.id]);

  useEffect(() => {
    if (guest) {
      sessionStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(messages.slice(-8)));
    }
  }, [messages, guest]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        launcherRef.current?.focus();
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll("button, input, a");
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

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

  async function send(event, suggested) {
    event?.preventDefault();
    const text = (suggested ?? message).trim();
    if (!text || loading || confirmingBooking) return;
    setError(""); setMessage("");
    sessionStorage.setItem("kairos_chatbot_tooltip_seen", "1");
    setShowTooltip(false);
    if (!guest && bookingProposal && isReservationConfirmation(text)) {
      await confirmReservation(bookingProposal, text);
      return;
    }
    if (!guest && bookingProposal) {
      clearPendingChatbotProposal(user?.id);
      setBookingProposal(null);
      setPaymentReservationId(null);
      setBookingError("");
      setExistingHolds([]);
    }
    setLoading(true);
    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    try {
      const data = guest
        ? await sendGuestMessage(nextMessages)
        : await sendMessage(text);
      if (!guest && data.booking_proposal) {
        savePendingChatbotProposal(user?.id, data.booking_proposal);
        setBookingProposal(data.booking_proposal);
        setPaymentReservationId(null);
        setBookingError("");
      }
      setMessages((current) => [...current, { role: "assistant", content: data.message }]);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }

  async function clear() {
    if (guest) {
      sessionStorage.removeItem(GUEST_STORAGE_KEY);
      setMessages([]);
      setError("");
      return;
    }
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

  return (
    <div className={`${portal ? "fixed" : "fixed"} bottom-4 right-4 z-[55] pb-[env(safe-area-inset-bottom)] sm:bottom-5 sm:right-5`}>
      {open && (
        <section ref={panelRef} className={`mb-3 flex ${portal ? "h-[min(30rem,75vh)]" : "h-[min(38rem,85vh)]"} w-[calc(100vw-2rem)] max-w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-white shadow-2xl motion-safe:animate-[chatbot-in_200ms_ease-out] sm:h-[min(30rem,75vh)] sm:w-[min(24rem,calc(100vw-2.5rem))] sm:rounded-2xl`} role="dialog" aria-modal="true" aria-labelledby="chatbot-title">
          <div className="flex items-center justify-between bg-navy px-5 py-4 text-white">
            <div className="flex items-center gap-3"><BrandLogo size="sm" collapsed linkTo={null} /><div><p id="chatbot-title" className="font-bold">Kai Azul Concierge</p><p className="text-xs text-white/60">{resortName || "Resort"} virtual concierge</p></div></div>
            <div className="flex gap-1"><button className="rounded px-2 text-xs hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" onClick={clear}>{guest ? "Clear chat" : "Clear"}</button><button className="rounded-full p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" onClick={() => { setOpen(false); launcherRef.current?.focus(); }} aria-label="Close chat">×</button></div>
          </div>
          {guest && <div className="border-b border-border bg-blue-50 px-4 py-3 text-xs text-navy">You're chatting as a guest. Log in to ask about your reservations. <Link className="font-bold text-primary underline" to="/login">Log in</Link> or <Link className="font-bold text-primary underline" to="/register">Register</Link>.</div>}
          <div className="flex-1 space-y-3 overflow-y-auto bg-tint/40 p-4" aria-live="polite">
            {messages.length === 0 && <div className="space-y-2"><p className="text-sm text-navy/70">How can I help with your {resortName || "resort"} stay?</p>{starters.map((item) => <button key={item} onClick={() => send(null, item)} className="block max-w-full rounded-full border border-border bg-white px-3 py-2 text-left text-xs font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{item}</button>)}</div>}
            {messages.map((item, index) => <div key={`${item.role}-${index}`} className={`max-w-[85%] break-words rounded-2xl px-4 py-3 text-sm ${item.role === "user" ? "ml-auto bg-primary text-white" : "bg-white text-navy shadow-sm"}`}><ChatbotMessageContent content={item.content} /></div>)}
            {portal && !guest && <ChatbotReservationReview proposal={bookingProposal} paymentReservationId={paymentReservationId} confirming={confirmingBooking} error={bookingError} existingHolds={existingHolds} onConfirm={() => confirmReservation()} />}
            {loading && <p className="text-sm text-navy/60" role="status">Kai Azul Concierge is thinking…</p>}<div ref={endRef} />
          </div>
          <form className="border-t border-border p-3" onSubmit={send}><div className="flex gap-2"><input aria-label="Chat message" maxLength={guest ? MAX_INPUT_LENGTH : 1000} className="min-w-0 flex-1 rounded-xl border border-border px-4 py-2 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask a question…" disabled={loading || confirmingBooking} /><button disabled={loading || confirmingBooking} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" type="submit">Send</button></div>{error && <p className="mt-1 text-xs font-bold text-red-700" role="alert">{error}</p>}</form>
          {!guest && <Link className="pb-3 text-center text-xs font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" to="/portal/chat" onClick={() => setOpen(false)}>Open full concierge</Link>}
        </section>
      )}
      <div className="relative flex justify-end"><span className={`pointer-events-none absolute bottom-full right-0 mb-2 hidden rounded-lg bg-navy px-3 py-2 text-xs font-bold text-white shadow-lg transition-opacity sm:block ${showTooltip && !open ? "opacity-100" : "opacity-0"}`}>Ask us</span><button ref={launcherRef} onClick={() => { setOpen((current) => !current); setShowTooltip(false); sessionStorage.setItem("kairos_chatbot_tooltip_seen", "1"); }} className="grid h-12 w-12 place-items-center rounded-full bg-primary text-lg font-black text-white shadow-xl transition hover:bg-sky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:size-14" aria-label={open ? "Close chat" : "Ask us"}>{open ? "×" : <BrandLogo size="sm" collapsed linkTo={null} />}</button></div>
    </div>
  );
}
