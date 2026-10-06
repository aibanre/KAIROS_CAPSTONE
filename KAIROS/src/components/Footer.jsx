import { useResortInfo } from '../context/ResortInfoContext.jsx'

const quickLinks = ['Home', 'Rooms', 'Venues', 'Amenities']
const reservations = ['Book a Room', 'Book a Venue', 'Check Availability', 'Contact Us']
const policies = ['Terms & Conditions', 'Privacy Policy', 'Cancellation Policy', 'Payment Policy']

export function Footer() {
	const { resort_name: resortName, address, contact_number: contactNumber, email } = useResortInfo()
	const phoneHref = `tel:${contactNumber.replace(/[^\d+]/g, '')}`
	return (
		<footer id="contact" className="w-full bg-slate-950 text-slate-300">
			<div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
				<div className="grid gap-10 md:grid-cols-4">
					<div>
						<h3 className="text-2xl font-bold text-white" style={{ fontFamily: 'Lora' }}>
							{resortName}
						</h3>
						<div className="mt-4 space-y-1 text-sm leading-6 text-slate-400">
							<p>{address}</p>
							<p><a href={phoneHref}>{contactNumber}</a></p>
							<p><a href={`mailto:${email}`}>{email}</a></p>
						</div>
					</div>

					<div>
						<h4 className="text-base font-semibold text-white">Quick Links</h4>
						<ul className="mt-4 space-y-2 text-sm text-slate-400">
							{quickLinks.map((item) => (
								<li key={item}><a href={`#${item.toLowerCase()}`} className="transition hover:text-white">{item}</a></li>
							))}
						</ul>
					</div>

					<div>
						<h4 className="text-base font-semibold text-white">Reservations</h4>
						<ul className="mt-4 space-y-2 text-sm text-slate-400">
							{reservations.map((item) => (
								<li key={item}><a href="#" className="transition hover:text-white">{item}</a></li>
							))}
						</ul>
					</div>

					<div>
						<h4 className="text-base font-semibold text-white">Policies</h4>
						<ul className="mt-4 space-y-2 text-sm text-slate-400">
							{policies.map((item) => (
								<li key={item}><a href="#" className="transition hover:text-white">{item}</a></li>
							))}
						</ul>
					</div>
				</div>

				<div className="mt-10 border-t border-white/10 pt-5 text-center text-sm text-slate-500">
					© 2025 {resortName} — KAIROS Integrated Reservation System
				</div>
			</div>
		</footer>
	)
}
