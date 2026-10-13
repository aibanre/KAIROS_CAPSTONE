import heroBackground from '../../assets/images/background/image.png';
import { useResortInfo } from '../context/ResortInfoContext.jsx'

export function HeroSection({ numberOfGuests, onNumberOfGuestsChange }) {
    const { resort_name: resortName } = useResortInfo()

    return (
        <section className="relative w-full overflow-hidden pt-16">
        <div
            className="relative flex min-h-[420px] items-center justify-center bg-cover bg-center bg-no-repeat sm:min-h-[500px]"
            style={{ backgroundImage: `url(${heroBackground})` }}
        >
            <div className="absolute inset-0 bg-gradient-to-b from-blue-950/90 via-blue-950/65 to-blue-950/45" />
            <div className="relative z-10 w-full max-w-3xl px-4 text-center sm:px-6">
                <div className="flex flex-col items-center gap-3">
                    <div className="motion-safe:animate-fade-up font-['DM_Sans'] text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300" style={{ animationDelay: '0ms' }}>Welcome to Paradise</div>
                    <h1 className="motion-safe:animate-fade-up font-['Lora'] text-3xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl" style={{ animationDelay: '120ms' }}>{resortName}</h1>
                    <p className="motion-safe:animate-fade-up max-w-xl text-base leading-7 text-sky-100 sm:text-lg" style={{ animationDelay: '240ms' }}>Where the ocean meets luxury — unforgettable stays await</p>
                </div>
            </div>
        </div>
    </section>
    );
}
