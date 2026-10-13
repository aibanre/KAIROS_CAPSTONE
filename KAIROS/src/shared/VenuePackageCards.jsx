import { normalizeInclusions } from "./venuePackages.js"

function formatPrice(value) {
	return `₱${Number(value || 0).toLocaleString("en-PH")}`
}

export default function VenuePackageCards({ packages = [], selectedId = "", onChange, name = "package", compact = false }) {
	if (!packages.length) return null

	return (
		<div role="radiogroup" aria-label="Venue packages" className="grid gap-3">
			{packages.map((pkg) => {
				const selected = String(pkg.package_id) === String(selectedId)
				const inclusions = normalizeInclusions(pkg.inclusions)
				const price = pkg.pricing_type === "per_person"
					? `${formatPrice(pkg.price)} per person`
					: `${formatPrice(pkg.price)} flat`
				return (
					<label
						key={pkg.package_id}
						className={`relative block cursor-pointer rounded-2xl border p-4 text-left transition focus-within:ring-2 focus-within:ring-sky-300 ${
							selected
								? "border-sky-600 bg-sky-50 ring-2 ring-sky-200"
								: "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/40"
						}`}
					>
						<input
							type="radio"
							name={name}
							value={pkg.package_id}
							checked={selected}
							onChange={() => onChange?.(pkg)}
							className="sr-only"
						/>
						<span className={`absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border text-xs font-bold ${
							selected ? "border-sky-600 bg-sky-600 text-white" : "border-slate-300 bg-white text-transparent"
						}`} aria-hidden="true">✓</span>
						<div className="pr-8">
							<p className={`${compact ? "text-sm" : "text-base"} font-bold text-slate-800`}>{pkg.package_name}</p>
							<p className="mt-1 text-sm font-bold text-sky-700">{price}</p>
						</div>
						{pkg.description ? <p className="mt-3 text-xs leading-5 text-slate-600">{pkg.description}</p> : null}
						{inclusions.length ? <ul className="mt-3 grid grid-cols-1 gap-2 text-xs leading-5 text-slate-500 sm:grid-cols-2">
							{inclusions.map((inclusion) => <li key={inclusion}><span className="mr-2 font-bold text-emerald-600">✓</span>{inclusion}</li>)}
						</ul> : null}
						{pkg.min_pax ? <p className="mt-3 text-xs font-semibold text-slate-500">Minimum {pkg.min_pax} guests</p> : null}
					</label>
				)
			})}
		</div>
	)
}
