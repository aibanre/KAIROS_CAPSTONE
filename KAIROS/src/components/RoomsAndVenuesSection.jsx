import { Link } from 'react-router-dom'

const rooms = [
	{
		title: 'Room Type #1',
		guests: '2 Guests',
		price: '₱4,500',
		tag: 'Ocean View',
		label: '[ Deluxe Ocean View ]',
	},
	{
		title: 'Room Type #2',
		guests: '3 Guests',
		price: '₱6,800',
		tag: 'Ocean View',
		label: '[ Beach Suite ]',
	},
	{
		title: 'Room Type #3',
		guests: '4 Guests',
		price: '₱8,200',
		tag: 'Ocean View',
		label: '[ Garden Villa ]',
	},
	{
		title: 'Room Type #4',
		guests: '4 Guests',
		price: '₱5,500',
		tag: 'Ocean View',
		label: '[ Family Room ]',
	},
]

const venues = [
	{
		title: 'Venue Type #2',
		guests: 'Up to 150 guests',
		price: '₱25,000 / event',
		label: '[ Beachfront Pavilion ]',
	},
	{
		title: 'Venue #3',
		guests: 'Up to 300 guests',
		price: '₱45,000 / event',
		label: '[ Grand Ballroom ]',
	},
	{
		title: 'Venue Type #5',
		guests: 'Up to 80 guests',
		price: '₱18,000 / event',
		label: '[ Sunset Terrace ]',
	},
]

function Card({ title, guests, price, tag, label, actionLabel }) {
	return (
		<article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0px_1px_3px_0px_rgba(0,0,0,0.08)]">
			<div className="flex h-40 items-center justify-center bg-slate-100 text-center text-[12px] tracking-[0.2em] text-slate-400 sm:h-48">
				{label}
			</div>
			<div className="p-4">
				<h3 className="text-base font-bold text-slate-700">{title}</h3>
				<div className="mt-1 text-sm text-slate-500">{guests}</div>
				<div className="mt-2 text-base font-bold text-sky-700">{price}</div>
				{tag ? (
					<div className="mt-3 flex flex-wrap gap-2">
						<span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-600">
							Available
						</span>
						<span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-600">
							{tag}
						</span>
					</div>
				) : null}
				<button
					type="button"
					className="mt-4 w-full rounded-full border border-sky-400 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50"
				>
					{actionLabel}
				</button>
			</div>
		</article>
	)
}

export function RoomsAndVenuesSection() {
	return (
		<section className="bg-slate-50 px-4 py-12 text-slate-100 sm:px-6 lg:px-8">
			<div className="mx-auto max-w-7xl">
				<header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h2 className="text-3xl font-bold text-slate-800 sm:text-4xl">Featured Rooms &amp; Venues</h2>
						<p className="mt-1 text-sm font-semibold text-slate-600 sm:text-base">
							Handpicked accommodations and venues for every occasion
						</p>
					</div>
					<Link to="/rooms-and-venues-details" className="inline-flex shrink-0 items-center justify-center rounded-xl bg-sky-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-800">
						More About Rooms
					</Link>
				</header>

				<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
					{rooms.map((room) => (
						<Card key={room.title} {...room} actionLabel="View Details" />
					))}
				</div>
			</div>
		</section>
	)
}
