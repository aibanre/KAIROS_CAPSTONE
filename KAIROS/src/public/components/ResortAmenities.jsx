import { Reveal } from './Reveal.jsx'
import { useRef, useState } from 'react'
import { amenities } from '../data/amenities.js'
import { AmenityIcon, AmenityModal } from './AmenityModal.jsx'

export function ResortAmenities() {
	const [selectedAmenity, setSelectedAmenity] = useState(null)
	const triggerRefs = useRef({})

	const closeModal = () => {
		const id = selectedAmenity?.id
		setSelectedAmenity(null)
		if (id) requestAnimationFrame(() => triggerRefs.current[id]?.focus())
	}

	const checkAvailability = () => {
		closeModal()
		requestAnimationFrame(() => document.getElementById('availability-calendar')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
	}

	return (
		<section id="amenities" className="scroll-mt-20 w-full bg-slate-50 px-4 py-8 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
			<div className="mx-auto max-w-7xl">
				<Reveal as="header" className="mb-10 text-slate-800">
					<div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">At your service</div>
					<h2 className="font-['Lora'] text-xl font-bold tracking-tight text-slate-800 sm:text-3xl">
						Resort Amenities
					</h2>
					<p className="mt-2 text-xs text-slate-500 sm:text-base">
						Everything you need for the perfect resort experience
					</p>
				</Reveal>

				<div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth py-2 -mx-4 px-4 touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:items-stretch sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:snap-none sm:py-0 xl:grid-cols-6">
					{amenities.map((amenity, index) => (
						<Reveal as="article" key={amenity.id} delay={Math.min(index, 1) * 80} className="h-full w-[42%] shrink-0 snap-start py-1 min-[480px]:w-[34%] sm:w-auto">
							<button type="button" aria-haspopup="dialog" ref={(element) => { triggerRefs.current[amenity.id] = element }} onClick={() => setSelectedAmenity(amenity)} className="flex h-full min-h-[116px] w-full cursor-pointer flex-col items-center rounded-xl border border-slate-200 bg-white px-3 py-4 text-center shadow-sm transition duration-200 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 sm:min-h-[140px] sm:rounded-2xl sm:px-5 sm:py-6">
								<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 sm:h-14 sm:w-14 sm:rounded-2xl"><AmenityIcon type={amenity.icon} /></div>
								<div className="mt-2 flex min-h-[2.75rem] items-center justify-center text-center text-xs font-medium text-slate-700 sm:mt-4 sm:text-base">{amenity.name}</div>
								<span className="mt-auto inline-flex items-center gap-1 text-[0.65rem] font-semibold text-sky-700">{amenity.photos.length > 0 ? 'View photos' : 'View details'} <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
							</button>
						</Reveal>
					))}
				</div>
			</div>
			{selectedAmenity ? <AmenityModal amenity={selectedAmenity} onClose={closeModal} onCheckAvailability={checkAvailability} /> : null}
		</section>
	)
}
