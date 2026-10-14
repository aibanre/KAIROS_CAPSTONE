import { BedDouble, Building2, CalendarDays, TentTree } from "lucide-react";
import { ProgressiveImage } from "./ProgressiveImage";

const icons = {
	room: BedDouble,
	venue: Building2,
	reservation: CalendarDays,
};

export default function ResourceImage({ src, alt = "", name = "", type = "room", large = false, wrapperClassName = "", className = "", ...props }) {
	const Icon = icons[type] || TentTree;
	const fallback = (
		<div className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-teal-100 text-teal-700 ${large ? "p-5" : ""}`}>
			<Icon size={large ? 48 : 24} strokeWidth={1.5} aria-hidden="true" />
			{large && name ? <span className="text-center text-sm font-bold text-teal-900">{name}</span> : null}
		</div>
	);

	return (
		<ProgressiveImage
			{...props}
			src={src}
			alt={alt}
			wrapperClassName={`h-full w-full ${wrapperClassName}`}
			className={className}
			fallback={fallback}
		/>
	);
}
