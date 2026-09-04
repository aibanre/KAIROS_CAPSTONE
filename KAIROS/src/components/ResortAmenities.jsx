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
		<section className="w-full bg-slate-50 px-4 py-14 sm:px-6 lg:px-8">
			<div className="mx-auto max-w-7xl">
				<header className="mb-10 text-slate-800">
					<h2 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ fontFamily: 'Lora' }}>
						Resort Amenities
					</h2>
					<p className="mt-2 text-sm text-slate-500 sm:text-base">
						Everything you need for the perfect resort experience
					</p>
				</header>

				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
					{amenities.map((amenity) => (
						<article
							key={amenity.label}
							className="flex min-h-[124px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-6 text-center shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
						>
							<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50">
								{amenity.icon}
							</div>
							<div className="mt-4 text-base font-medium text-slate-700">{amenity.label}</div>
						</article>
					))}
				</div>
			</div>
		</section>
	)
}
