import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useResortInfo } from '../context/ResortInfoContext.jsx'
import { API_URL } from '../../config/api.js'
import { Footer } from './Footer.jsx'

const LAST_UPDATED = 'October 8, 2026'

function Contact({ resort }) {
	const values = [resort.address, resort.contact_number, resort.email].filter(Boolean)
	if (!values.length) return null
	return <p className="mt-3 text-sm text-slate-600">{values.map((value, index) => <span key={`${value}-${index}`} className="block">{value}</span>)}</p>
}

function policySections(resort, paymentMethods) {
	const contact = resort.resort_name ? `Contact ${resort.resort_name}` : 'Contact the resort'
	const methods = paymentMethods.length ? paymentMethods.join(', ') : 'the receipt-based payment methods shown during checkout'
	return {
		terms: {
			title: 'Terms and Conditions',
			sections: [
				['acceptance', 'Acceptance of these terms', ['By using this website, creating an account, or making a reservation, you agree to these Terms and Conditions. If you do not agree, do not use the service.']],
				['accounts', 'Eligibility and account registration', ['You must provide accurate, current information and keep your account credentials confidential. You are responsible for activity under your account and must promptly correct inaccurate details.']],
				['bookings', 'Bookings and confirmation', ['Availability and prices are calculated by the reservation system. An online room or venue booking requires the applicable deposit to confirm it; staff verification of submitted payment proof is required before confirmation. An unpaid payment hold may expire and be cancelled automatically. All bookings are final: cancellations, refunds, and rebooking are not available.']],
				['schedule', 'Check-in, check-out, and fees', ['Standard room check-in is 2:00 PM and check-out is 12:00 noon, Asia/Manila. Early check-in and late check-out are subject to availability and cost PHP 500 per started hour. Check-out may be blocked while a balance is due.']],
				['capacity', 'Guest capacity and extra beds', ['Guests must stay within the published room or venue capacity. Extra beds are arranged subject to availability and cost PHP 450 each, charged on arrival.']],
				['resort-rules', 'Resort Rules and Guest Conduct', [
					`${resort.resort_name || 'The resort'} management is not responsible for any lost or stolen belongings. Guests must keep their personal items safe.`,
					'Videoke/karaoke is strictly prohibited. Sound systems must not disturb nearby cottages or other guests.',
					'Do not take any resort property, including utensils, outside the premises. Taking resort property is a criminal offense.',
					'Please throw trash in the garbage bins provided. For any concerns or complaints, inform the management immediately.',
					'Beachgoers swimming in the sea must wear a life vest, provided free of charge. This is mandatory.',
				]],
				['booking-eligibility', 'Booking Eligibility, Pets and Identification', [
					'Bookers must be at least 18 years old. Reservations by minors are not allowed.',
					'A valid government-issued ID may be requested at check-in.',
					'Pets are allowed in rooms only if they wear diapers and have their own bed.',
				]],
				['conduct', 'Room rules and guest conduct', ['Guests must follow resort rules, use facilities responsibly, and avoid conduct that disturbs other guests or damages property. The resort may refuse service or require a guest to leave for rule violations.']],
				['damages', 'Damages and inventory inspection', ['The resort may inspect inventory at check-out. Loss or damage charges are payable before check-out and may be collected from the responsible guest.']],
				['venues', 'Venue rules', ['Small Cottage and Big Cottage day-use bookings run from 08:00 to 17:00, with one booking per venue and date. Conference Hall bookings use an active package, its minimum and maximum pax, included hours, and the configured extra-hour rate; requested hours must fit the venue schedule.']],
				['qr', 'QR check-in code', ['A QR check-in code is for the reservation and guest check-in process. Keep it private and present it only to authorized resort staff.']],
				['liability', 'Information and liability', ['You are responsible for accurate reservation and guest information. To the extent allowed by law, the resort is not responsible for loss caused by inaccurate information, misuse of credentials, or events outside its reasonable control.']],
				['changes', 'Changes and governing law', ['The resort may update these terms by posting a revised version. These terms are governed by the laws of the Republic of the Philippines.']],
				['contact', 'Contact', [`For questions about these terms, ${contact}.`]],
			],
		},
		privacy: {
			title: 'Privacy Policy',
			sections: [
				['data', 'Information we collect', ['We collect names, email addresses, phone numbers, addresses, dates of birth for registered accounts, reservation and payment records, payment proof images, chatbot messages from logged-in customers, and staff audit logs.']],
				['purpose', 'How we use information', ['We use information to provide reservations, verify payments, send email notifications, support check-in, provide customer support, secure the service, and meet accountability requirements.']],
				['basis', 'Legal basis and consent', ['We process information to provide requested services, perform reservation and payment arrangements, comply with legal obligations, and with your consent where required. You may withdraw consent where applicable, subject to lawful processing and existing records.']],
				['access', 'Who can access information', ['Resort staff access information according to their role, including authorized admin and receptionist staff. Customer contact details are not shown in chatbot conversation history.']],
				['providers', 'Service providers', ['Payment proof and other uploaded images are processed through Cloudinary. Email notifications are sent through the SMTP email provider configured by the resort. Reservation and account data are stored on the configured database host. The landing page embeds Google Maps and Street View, which may process your IP address and set cookies.']],
				['cookies', 'Cookies and storage', ['Staff and customer sessions use the httpOnly kairos_auth cookie. Guest reservation access uses a sessionStorage reservation token for up to 24 hours.']],
				['retention', 'Retention', ['TODO: The application does not define a retention period. The resort owner should set and publish retention periods for each data category.']],
				['security', 'Security measures', ['The application uses hashed passwords, httpOnly cookies, role-based access controls, and rate limiting. No security measure guarantees absolute security.']],
				['rights', 'Data subject rights', ['Under the Data Privacy Act of 2012 (RA 10173), you may request access, correction, erasure or blocking, object to processing, request data portability, and complain to the National Privacy Commission, subject to applicable law.']],
				['exercise', 'How to exercise your rights', [`To make a privacy request, ${contact}.`]],
				['children', 'Children', ['The service is not directed to children who cannot lawfully consent. A parent or guardian should contact the resort if a child’s information was provided improperly.']],
				['changes', 'Changes to this policy', ['We may update this policy by posting a revised version with a new last-updated date.']],
			],
		},
		'payment-policy': {
			title: 'Payment Policy',
			sections: [
				['online', 'Online reservations', ['Online room and venue reservations require a 50% deposit. The deposit confirms the reservation and is non-refundable. The remaining balance is paid on arrival or before check-out; check-out may be blocked while a balance is due. All amounts are in Philippine Peso.']],
				['methods', 'Payment methods and proof', [`Payment methods are the receipt-based methods displayed at checkout, currently: ${methods}. Upload proof as JPEG, PNG, or WebP, up to 5 MB. Resort staff verify proof before the reservation is confirmed.`]],
				['hold', 'Payment holds', ['An unpaid reservation payment hold expires after 10 minutes. The reservation is then cancelled automatically.']],
				['walkin', 'Walk-in bookings', ['Walk-in bookings are paid in full upfront using the available resort payment process.']],
				['venue', 'Venue payments and pricing', ['Online venue bookings follow the payment amount shown by the quote and checkout. Small Cottage and Big Cottage are day-use venues from 08:00 to 17:00. Conference Hall pricing follows the selected package, its minimum pax, included hours, and configured extra-hour charges.']],
				['fees', 'Additional charges', ['Early check-in and late check-out cost PHP 500 per started hour. Standard room times are 2:00 PM check-in and 12:00 noon check-out, Asia/Manila. Extra beds cost PHP 450 each and are charged on arrival.']],
				['final', 'No cancellations, refunds, or rebooking', ['All bookings are final. Deposits are non-refundable, and the system does not provide cancellation, refund, or rebooking. The only automatic cancellation described here is an unpaid hold that expires.']],
				['contact', 'Contact', [`For payment questions, ${contact}.`]],
			],
		},
	}
}

export default function PolicyPage({ policy }) {
	const resort = useResortInfo()
	const [paymentMethods, setPaymentMethods] = useState([])
	const sections = useMemo(() => policySections(resort, paymentMethods)[policy], [policy, resort, paymentMethods])

	useEffect(() => {
		document.title = sections ? `${sections.title} | ${resort.resort_name || 'KAIROS'}` : 'KAIROS'
	}, [resort.resort_name, sections])

	useEffect(() => {
		if (policy !== 'payment-policy') return undefined
		const controller = new AbortController()
		fetch(`${API_URL}/api/payment-methods`, { signal: controller.signal, credentials: 'include' })
			.then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load payment methods.')))
			.then((data) => setPaymentMethods((data.paymentMethods || []).map((method) => method.method_name).filter(Boolean)))
			.catch((error) => { if (error.name !== 'AbortError') setPaymentMethods([]) })
		return () => controller.abort()
	}, [policy])

	if (!sections) return null
	return (
		<>
			<main className="min-h-screen overflow-x-hidden bg-slate-50 px-4 py-10 text-slate-700 print:bg-white sm:px-6 lg:px-8">
				<div className="mx-auto max-w-5xl">
					<Link to="/" className="text-sm font-semibold text-sky-700 hover:text-sky-900 print:hidden">← Back to home</Link>
					<header className="mt-6 border-b border-slate-200 pb-6">
						<h1 className="font-serif text-4xl font-bold text-slate-900">{sections.title}</h1>
						<p className="mt-3 text-sm text-slate-500">Last updated: {LAST_UPDATED}</p>
						<Contact resort={resort} />
					</header>
					<nav aria-label="Table of contents" className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 print:hidden">
						<h2 className="font-semibold text-slate-900">Contents</h2>
						<ol className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
							{sections.sections.map(([id, heading], index) => <li key={id}><a className="text-sky-700 hover:underline" href={`#${id}`}>{index + 1}. {heading}</a></li>)}
						</ol>
					</nav>
					<div className="mt-8 space-y-8">
						{sections.sections.map(([id, heading, paragraphs], index) => (
							<section id={id} key={id} className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
								<h2 className="font-serif text-2xl font-bold text-slate-900">{index + 1}. {heading}</h2>
								{paragraphs.map((paragraph) => <p key={paragraph} className="mt-3 leading-7">{paragraph}</p>)}
							</section>
						))}
					</div>
				</div>
			</main>
			<Footer />
		</>
	)
}
