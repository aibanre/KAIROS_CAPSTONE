import bar1 from '../../assets/images/amenities/bar1.jpg'
import restaurant1 from '../../assets/images/amenities/restaurant1.jpg'
import restaurant2 from '../../assets/images/amenities/restaurant2.jpg'
import pisoWifi1 from '../../assets/images/amenities/pisowifi1.png'
import park1 from '../../assets/images/amenities/park1.jpg'
import park2 from '../../assets/images/amenities/park2.jpg'
import park3 from '../../assets/images/amenities/park3.jpg'
import park4 from '../../assets/images/amenities/park4.jpg'
import recreation1 from '../../assets/images/amenities/recreation1.jpg'
import recreation2 from '../../assets/images/amenities/recreation2.jpg'
import recreation3 from '../../assets/images/amenities/recreation3.jpg'
import recreation4 from '../../assets/images/amenities/recreation4.jpg'
import recreation5 from '../../assets/images/amenities/recreation5.jpg'
import ktv1 from '../../assets/images/amenities/ktv1.jpg'
import liveBand1 from '../../assets/images/amenities/liveband1.png'

export const amenities = [
	{
		id: 'restaurant-bar',
		name: 'Restaurant & Bar',
		icon: 'utensils',
		description: 'Enjoy relaxed dining and drinks throughout your resort stay.',
		// TODO: Replace these placeholders with confirmed hours and rates.
		details: ['TODO: Add restaurant hours', 'TODO: Add rates or menu guidance'],
		photos: [restaurant1, restaurant2, bar1],
	},
	{
		id: 'piso-wifi',
		name: 'Piso WiFi',
		icon: 'wifi',
		description: 'Stay connected with convenient WiFi access around the resort.',
		// TODO: Replace these placeholders with confirmed access information and rates.
		details: ['TODO: Add coverage areas', 'TODO: Add access instructions', 'TODO: Confirm rates'],
		photos: [pisoWifi1],
	},
	{
		id: 'parking',
		name: 'Parking',
		icon: 'parking',
		description: 'Convenient on-site parking helps make arrivals and day visits easy.',
		// TODO: Replace these placeholders with confirmed hours, instructions, and rates.
		details: ['TODO: Add parking hours', 'TODO: Add parking instructions', 'TODO: Confirm rates'],
		photos: [park1, park2, park3, park4],
	},
	{
		id: 'recreational-activities',
		name: 'Recreational Activities',
		icon: 'activity',
		description: 'Make time for active fun and relaxing recreation during your visit.',
		// TODO: Replace these placeholders with confirmed activities, hours, and rates.
		details: ['TODO: Add available activities', 'TODO: Add activity hours', 'TODO: Confirm rates'],
		photos: [recreation1, recreation2, recreation3, recreation4, recreation5],
	},
	{
		id: 'ktv-room',
		name: 'KTV Room',
		icon: 'microphone',
		description: 'Gather your group for a private sing-along in the KTV room.',
		// TODO: Replace these placeholders with confirmed hours, instructions, and rates.
		details: ['TODO: Add KTV hours', 'TODO: Add booking instructions', 'TODO: Confirm rates'],
		photos: [ktv1],
	},
	{
		id: 'live-band',
		name: 'Live Band',
		icon: 'music',
		description: 'Enjoy live music performances during your stay.',
		// TODO: Replace these placeholders with confirmed hours, instructions, and rates.
		details: ['TODO: Add live band hours', 'TODO: Add booking instructions', 'TODO: Confirm rates'],
		photos: [liveBand1],
	},
]