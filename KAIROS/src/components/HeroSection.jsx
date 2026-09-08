import heroBackground from '../assets/images/background/image.png';

export function HeroSection({ numberOfGuests, onNumberOfGuestsChange }) {
    const handleSearch = (event) => {
        event.preventDefault();
        document.getElementById('availability-calendar')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <section className="relative w-full overflow-hidden pt-16">
        <div
            className="relative w-full min-h-[500px] bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${heroBackground})` }}
        >
            <div className="absolute inset-0 bg-gradient-to-b from-blue-950/90 via-blue-950/60 to-blue-900/30" />
            <div className="absolute left-1/2 top-[180px] w-full max-w-[503.39px] -translate-x-1/2 px-4 sm:px-0">
                <div className="flex flex-col items-center justify-start gap-3">
                    <div className="text-center justify-start text-cyan-300 text-xs font-semibold font-['DM_Sans'] uppercase leading-4 tracking-wider">Welcome to Paradise</div>
                    <div className="text-center justify-start text-white text-5xl font-bold font-['Lora'] leading-[48px]">Kai Azul Beach Resort</div>
                    <div className="text-center justify-start text-sky-100 text-lg font-normal font-['DM_Sans'] leading-7">Where the ocean meets luxury — unforgettable stays await</div>
                </div>
            </div>
        </div>
        <div className="relative z-10 -mt-10 flex w-full justify-center px-4 sm:px-6">
            <form onSubmit={handleSearch} className="w-full max-w-[896px] rounded-2xl border border-gray-200 bg-white p-5 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.10),0px_1px_2px_-1px_rgba(0,0,0,0.10)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                    <label className="flex-1 min-w-28">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-tight text-gray-500 font-['DM_Sans']">Number of Guests</span>
                        <select value={numberOfGuests} onChange={(event) => onNumberOfGuestsChange(event.target.value)} className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm font-normal text-gray-700 font-['DM_Sans'] outline-none transition focus:border-sky-500 focus:bg-white">
                            <option>1 Adult</option>
                            <option>2 Adults</option>
                            <option>3 Adults</option>
                            <option>4 Adults</option>
                            <option>5+ Adults</option>
                        </select>
                    </label>
                    <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-sky-800"
                    >
                        <span className="size-3 relative overflow-hidden">
                            <span className="absolute left-[1.63px] top-[1.63px] size-2 border border-white" />
                            <span className="absolute left-[9.05px] top-[9.05px] size-0.5 border border-white" />
                        </span>
                        Search Availability
                    </button>
                </div>
            </form>
        </div>
    </section>
    );
}
