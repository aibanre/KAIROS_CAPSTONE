import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header.jsx'
import { HeroSection } from '../components/HeroSection.jsx'
import { RoomsAndVenuesSection } from '../components/RoomsAndVenuesSection.jsx'
import { ResortAmenities } from '../components/ResortAmenities.jsx'
import { Reviews } from '../components/Reviews.jsx'
import { LocationSection } from '../components/LocationSection.jsx'
import { Footer } from '../components/Footer.jsx'
import { AvailabilityCalendar } from '../components/AvailabilityCalendar.jsx'

export default function LandingPage() {
	const navigate = useNavigate()
	const [checkIn, setCheckIn] = useState(null)
	const [checkOut, setCheckOut] = useState(null)
	const [numberOfGuests, setNumberOfGuests] = useState('2 Adults')

	const searchAvailability = () => {
		if (!checkIn || !checkOut) return

		const guests = Number.parseInt(numberOfGuests, 10)
		const params = new URLSearchParams({ checkIn, checkOut, guests: String(guests) })
		navigate(`/rooms-and-venues?${params.toString()}`)
	}

	return (
		<>
			<Header />
			<HeroSection numberOfGuests={numberOfGuests} onNumberOfGuestsChange={setNumberOfGuests} />
			<div id="availability-calendar" className="scroll-mt-20 bg-slate-50">
				<AvailabilityCalendar
					mode="general"
					checkIn={checkIn}
					checkOut={checkOut}
					onRangeSelect={(newCheckIn, newCheckOut) => {
						setCheckIn(newCheckIn)
						setCheckOut(newCheckOut)
					}}
					action={checkIn && checkOut ? (
						<button
							type="button"
							onClick={searchAvailability}
							className="min-h-11 w-full rounded-xl bg-sky-700 px-5 text-sm font-medium text-white transition duration-200 motion-safe:active:scale-[0.98] motion-safe:hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 sm:w-auto"
						>
							Search Availability
						</button>
					) : null}
				/>
			</div>
			<RoomsAndVenuesSection
				checkIn={checkIn}
				checkOut={checkOut}
				guests={Number.parseInt(numberOfGuests, 10)}
			/>
			<ResortAmenities />
			<Reviews />
			<LocationSection />
			<Footer />
		</>
	)
}
