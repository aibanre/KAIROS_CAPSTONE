
import { Link } from 'react-router-dom'
import { useState } from 'react'
import logo from '../../assets/images/logo/transparent-kaiazul.png'
import { useResortInfo } from '../context/ResortInfoContext.jsx'
import { useCustomerAuth } from '../../customer/context/CustomerAuthContext.jsx'

export function Header() {
    const { resort_name: resortName } = useResortInfo()
    const { isAuthenticated, logout } = useCustomerAuth()
    const [menuOpen, setMenuOpen] = useState(false)
    const navItems = [
        { label: 'Home', to: '/' },
        { label: 'Rooms & Venues', to: '/rooms-and-venues' },
        { label: 'Amenities', to: '/#amenities', anchor: true },
        { label: 'Contact', to: '/#contact', anchor: true },
    ]

    const closeMenu = () => setMenuOpen(false)

    return (
        <header className="fixed left-0 top-0 z-50 w-full border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <Link to="/" onClick={closeMenu} className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                    <img src={logo} alt={`${resortName} logo`} className="h-10 w-10 shrink-0 object-contain" />
                    <div className="min-w-0 max-w-[130px]">
                        <div className="truncate font-['Lora'] text-sm font-bold leading-4 text-sky-800">{resortName}</div>
                        <div className="font-['DM_Sans'] text-xs leading-4 text-slate-400">Beach Resort</div>
                    </div>
                </Link>
                <button type="button" aria-expanded={menuOpen} aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} onClick={() => setMenuOpen(!menuOpen)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 md:hidden">
                    <span className="text-2xl leading-none">{menuOpen ? '×' : '☰'}</span>
                </button>
                <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
                    {navItems.map((item) => item.anchor ? (
                        <a key={item.label} href={item.to} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">{item.label}</a>
                    ) : (
                        <Link key={item.label} to={item.to} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">{item.label}</Link>
                    ))}
                </nav>
                <div className="hidden items-center gap-2 md:flex">
                    {isAuthenticated ? (
                        <>
                            <Link to="/portal" className="inline-flex min-h-11 items-center rounded-xl border border-sky-700 px-3 text-xs font-medium text-sky-700 transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">My Portal</Link>
                            <button type="button" onClick={() => logout()} className="inline-flex min-h-11 items-center rounded-xl bg-sky-700 px-3 text-xs font-medium text-white transition hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">Logout</button>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="inline-flex min-h-11 items-center rounded-xl border border-sky-700 px-3 text-xs font-medium text-sky-700 transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">Login</Link>
                            <Link to="/register" className="inline-flex min-h-11 items-center rounded-xl bg-sky-700 px-3 text-xs font-medium text-white transition hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">Register</Link>
                        </>
                    )}
                </div>
            </div>
            {menuOpen && <nav className="border-t border-slate-100 bg-white px-4 pb-4 pt-2 shadow-lg md:hidden" aria-label="Mobile navigation">
                {navItems.map((item) => item.anchor ? (
                    <a key={item.label} href={item.to} onClick={closeMenu} className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">{item.label}</a>
                ) : (
                    <Link key={item.label} to={item.to} onClick={closeMenu} className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">{item.label}</Link>
                ))}
                <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2">
                    {isAuthenticated ? (
                        <>
                            <Link to="/portal" onClick={closeMenu} className="flex min-h-11 items-center justify-center rounded-xl border border-sky-700 text-sm font-medium text-sky-700">My Portal</Link>
                            <button type="button" onClick={() => { logout(); closeMenu() }} className="flex min-h-11 items-center justify-center rounded-xl bg-sky-700 text-sm font-medium text-white">Logout</button>
                        </>
                    ) : (
                        <>
                            <Link to="/login" onClick={closeMenu} className="flex min-h-11 items-center justify-center rounded-xl border border-sky-700 text-sm font-medium text-sky-700">Login</Link>
                            <Link to="/register" onClick={closeMenu} className="flex min-h-11 items-center justify-center rounded-xl bg-sky-700 text-sm font-medium text-white">Register</Link>
                        </>
                    )}
                </div>
            </nav>}
        </header>
    );
}
