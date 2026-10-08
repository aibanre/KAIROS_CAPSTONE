import { Inbox } from "lucide-react";
import { Link } from "react-router";

export default function EmptyState({ title, message, actionLabel, to }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-9 text-center sm:rounded-3xl sm:px-6 sm:py-12">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-tint text-primary">
        <Inbox size={24} aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-lg font-bold text-navy">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate">{message}</p>
      {to && (
        <Link className="mt-5 inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-sky" to={to}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
