const reviews = [
	{
		name: 'Ana Reyes',
		quote: 'Absolutely breathtaking views and impeccable service. A perfect tropical getaway!',
		stars: 5,
	},
	{
		name: 'Marco Lim',
		quote: 'The beachfront suite was beyond all expectations. We will definitely be returning.',
		stars: 5,
	},
	{
		name: 'Chloe Park',
		quote: 'Beautiful resort with excellent amenities. The staff is incredibly warm and friendly.',
		stars: 4,
	},
]

function StarRow({ count }) {
	return (
		<div className="flex items-center gap-0.5 text-amber-400">
			{Array.from({ length: count }).map((_, index) => (
				<span key={index} className="text-lg leading-none">★</span>
			))}
		</div>
	)
}

function UserIcon() {
	return (
		<div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400">
			<svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
				<path
					fill="none"
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="1.8"
					d="M20 20a8 8 0 0 0-16 0m8-8a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
				/>
			</svg>
		</div>
	)
}

export function Reviews() {
	return (
		<section className="w-full bg-slate-50 px-4 py-14 sm:px-6 lg:px-8">
			<div className="mx-auto max-w-7xl">
				<header className="mb-8 text-slate-800">
					<h2 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ fontFamily: 'Lora' }}>
						What Our Guests Say
					</h2>
					<p className="mt-2 text-sm text-slate-500 sm:text-base">Hear from our valued guests</p>
				</header>

				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
					{reviews.map((review) => (
						<article
							key={review.name}
							className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
						>
							<StarRow count={review.stars} />
							<p className="mt-4 text-[15px] leading-7 text-slate-600">&ldquo;{review.quote}&rdquo;</p>
							<div className="mt-6 flex items-center gap-3">
								<UserIcon />
								<span className="text-base font-semibold text-slate-700">{review.name}</span>
							</div>
						</article>
					))}
				</div>
			</div>
		</section>
	)
}
