import { useResortInfo } from '../context/ResortInfoContext.jsx'

const quickLinks = ['Home', 'Rooms', 'Venues', 'Amenities']
const reservations = ['Book a Room', 'Book a Venue', 'Check Availability', 'Contact Us']
const policies = ['Terms & Conditions', 'Privacy Policy', 'Cancellation Policy', 'Payment Policy']

export function Footer() {
	const { resort_name: resortName, address, contact_number: contactNumber, email } = useResortInfo()
	const phoneHref = `tel:${(contactNumber || '').replace(/[^\d+]/g, '')}`
	return (
		<footer id="contact" className="scroll-mt-20 w-full bg-slate-950 text-slate-300">
			<div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
				<div className="grid grid-cols-2 gap-2 sm:gap-5 lg:grid-cols-4">
					<div className="col-span-2 lg:col-span-1">
						<h3 className="truncate text-lg font-bold text-white sm:text-2xl" style={{ fontFamily: 'Lora' }}>
							{resortName}
						</h3>
						<div className="mt-1 space-y-0 text-xs leading-5 text-slate-400 sm:mt-2 sm:space-y-1 sm:text-sm sm:leading-6">
							<p>{address}</p>
							<p><a href={phoneHref} className="inline-flex min-h-11 items-center transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">{contactNumber}</a></p>
							<p><a href={`mailto:${email}`} className="inline-flex min-h-11 items-center break-all transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">{email}</a></p>
						</div>
					</div>

					<div>
						<h4 className="text-sm font-semibold text-white sm:text-base">Quick Links</h4>
						<ul className="mt-1 space-y-0 text-xs text-slate-400 sm:mt-2 sm:space-y-1 sm:text-sm">
							{quickLinks.map((item) => (
								<li key={item}><a href={`#${item.toLowerCase()}`} className="inline-flex min-h-11 items-center transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">{item}</a></li>
							))}
						</ul>
					</div>

					<div>
						<h4 className="text-sm font-semibold text-white sm:text-base">Reservations</h4>
						<ul className="mt-1 space-y-0 text-xs text-slate-400 sm:mt-2 sm:space-y-1 sm:text-sm">
							{reservations.map((item) => (
								<li key={item}><a href="#" className="inline-flex min-h-11 items-center transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">{item}</a></li>
							))}
						</ul>
					</div>

					<div>
						<h4 className="text-sm font-semibold text-white sm:text-base">Policies</h4>
						<ul className="mt-1 space-y-0 text-xs text-slate-400 sm:mt-2 sm:space-y-1 sm:text-sm">
							{policies.map((item) => (
								<li key={item}><a href="#" className="inline-flex min-h-11 items-center transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">{item}</a></li>
							))}
						</ul>
					</div>
				</div>

				<div className="mt-3 border-t border-white/10 pt-2 text-center text-[10px] text-slate-500 sm:mt-5 sm:pt-3 sm:text-xs">
					© 2025 {resortName} — KAIROS Integrated Reservation System
				</div>
			</div>
		</footer>
	)
}
