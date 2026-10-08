const amenities = [
	{
		label: 'Restaurant & Bar',
		icon: (
			<svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 text-sky-600">
				<path fill="currentColor" d="M6 3h2v8H6zm4 0h2v8h-2zm3 0h2v8h-2z" />
				<path fill="currentColor" d="M6 11h10v2H6zm2 2h2v8H8zm4 0h2v8h-2zm4 0h2v8h-2z" />
			</svg>
		),
	},
	{
		label: 'Piso WiFi',
		icon: (
			<svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 text-sky-600">
				<path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M4 9c4.4-4.4 11.6-4.4 16 0" />
				<path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M7 12c2.7-2.7 7.3-2.7 10 0" />
				<path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M10 15c1.1-1.1 2.9-1.1 4 0" />
				<circle cx="12" cy="18" r="1.5" fill="currentColor" />
			</svg>
		),
	},
	{
		label: 'Parking',
		icon: (
			<svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 text-sky-600">
				<path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 17V7h7a4 4 0 0 1 0 8H8" />
				<path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8 7v10" />
				<path fill="currentColor" d="M4 18h16v2H4z" />
			</svg>
		),
	},
	{
		label: 'Recreational Activities',
		icon: (
			<svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 text-sky-600">
				<path fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9z" />
			</svg>
		),
	},
	{
		label: 'KTV Room',
		icon: (
			<svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 text-sky-600">
				<circle cx="10" cy="10" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
				<path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="m14 14 6 6" />
				<circle cx="10" cy="10" r="1.8" fill="currentColor" />
			</svg>
		),
	},
]

export function ResortAmenities() {
	return (
		<section id="amenities" className="scroll-mt-20 w-full bg-slate-50 px-4 py-8 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
			<div className="mx-auto max-w-7xl">
				<header className="mb-10 text-slate-800">
					<div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">At your service</div>
					<h2 className="font-['Lora'] text-xl font-bold tracking-tight text-slate-800 sm:text-3xl">
						Resort Amenities
					</h2>
					<p className="mt-2 text-xs text-slate-500 sm:text-base">
						Everything you need for the perfect resort experience
					</p>
				</header>

				<div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth pb-3 -mx-4 px-4 touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:snap-none sm:pb-0 lg:grid-cols-3 xl:grid-cols-5">
					{amenities.map((amenity) => (
						<article
							key={amenity.label}
							className="flex min-h-[116px] w-[42%] shrink-0 snap-start flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-4 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md min-[480px]:w-[34%] sm:min-h-[140px] sm:w-auto sm:rounded-2xl sm:px-5 sm:py-6"
						>
							<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 sm:h-14 sm:w-14 sm:rounded-2xl">
								{amenity.icon}
							</div>
							<div className="mt-2 text-xs font-medium text-slate-700 sm:mt-4 sm:text-base">{amenity.label}</div>
						</article>
					))}
				</div>
			</div>
		</section>
	)
}
