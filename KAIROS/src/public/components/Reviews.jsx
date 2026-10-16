import { useEffect, useState } from 'react'
import { API_URL } from '../../config/api.js'
import { Reveal } from './Reveal.jsx'

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
	const [reviews, setReviews] = useState([])

	useEffect(() => {
		const controller = new AbortController()
		fetch(`${API_URL}/api/reviews?random=1&limit=3`, { signal: controller.signal, cache: 'no-store', credentials: 'include' })
			.then(async (response) => {
				const data = await response.json()
				if (!response.ok) throw new Error(data.error || 'Failed to load reviews.')
				return data.reviews || []
			})
			.then((data) => setReviews(data
				.filter((review) => Number.isInteger(Number(review.rating)) && Number(review.rating) >= 1 && Number(review.rating) <= 5)
				.slice(0, 3)))
			.catch((error) => {
				if (error.name !== 'AbortError') setReviews([])
			})

		return () => controller.abort()
	}, [])

	if (!reviews.length) return null

	return (
		<section className="w-full bg-slate-50 px-4 py-8 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
			<div className="mx-auto max-w-7xl">
				<Reveal as="header" className="mb-8 text-slate-800">
					<div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Guestbook</div>
					<h2 className="font-['Lora'] text-xl font-bold tracking-tight text-slate-800 sm:text-3xl">
						What Our Guests Say
					</h2>
					<p className="mt-2 text-xs text-slate-500 sm:text-base">Hear from our valued guests</p>
				</Reveal>

				<div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth pb-3 -mx-4 px-4 touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:snap-none lg:pb-0">
					{reviews.map((review, index) => {
						const name = [review.first_name, review.last_name].filter(Boolean).join(' ') || 'Guest'
						return (
							<Reveal as="article" delay={Math.min(index, 1) * 80}
								key={review.review_id || `${name}-${review.created_at}`}
								className="w-[82%] shrink-0 snap-start rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-md sm:w-auto sm:rounded-2xl sm:p-6"
							>
								<StarRow count={Number(review.rating)} />
								<p className="mt-3 text-sm leading-6 text-slate-600 sm:mt-4 sm:text-[15px] sm:leading-7">&ldquo;{review.comment || ''}&rdquo;</p>
								<div className="mt-4 flex items-center gap-3 sm:mt-6">
									<UserIcon />
									<div>
										<span className="block text-sm font-semibold text-slate-700 sm:text-base">{name}</span>
										{review.resource_name ? <span className="block text-xs text-slate-500">{review.resource_type === 'venue' ? `Event at ${review.resource_name}` : `Stayed in ${review.resource_name}`}</span> : null}
									</div>
								</div>
							</Reveal>
						)
					})}
				</div>
			</div>
		</section>
	)
}
