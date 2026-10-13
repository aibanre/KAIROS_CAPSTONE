import VenuePackageCards from '../../shared/VenuePackageCards.jsx'

export default function VenuePackageInfo({ packages = [], selectedId, onChange }) {
	if (!packages.length) return null
	return (
		<section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
			<h2 className="text-sm font-bold text-slate-700">{packages.length > 1 ? 'Packages' : 'Package'}</h2>
			<div className="mt-3"><VenuePackageCards packages={packages} selectedId={selectedId} onChange={onChange} /></div>
		</section>
	)
}