
import { Link } from 'react-router-dom'
import logo from '../assets/images/logo/transparent-kaiazul.png'

export function Header() {
    return (
        <header className="fixed left-0 top-0 z-50 w-full border-b border-solid border-gray-200 bg-white">
            <div className="flex h-16 w-full items-center justify-between px-6">
            <div className="flex items-center gap-2.5">
                <img src={logo} alt="Kai Azul Beach Resort logo" className="h-10 w-10 object-contain" />
                <div className="w-20 inline-flex flex-col justify-start items-start">
                    <div className="self-stretch flex flex-col justify-start items-start">
                        <div className="justify-start text-sky-800 text-sm font-bold font-['Lora'] leading-4">Kai Azul</div>
                    </div>
                    <div className="self-stretch flex flex-col justify-start items-start">
                        <div className="justify-start text-gray-400 text-xs font-normal font-['DM_Sans'] leading-4">Beach Resort</div>
                    </div>
                </div>
            </div>
            <div className="size- flex justify-start items-center gap-0.5">
                <div className="size- px-3 py-1.5 rounded-xl inline-flex flex-col justify-center items-center">
                    <div className="text-center justify-start text-gray-600 text-sm font-medium font-['DM_Sans'] leading-5">Home</div>
                </div>
                <div className="size- px-3 py-1.5 rounded-xl inline-flex flex-col justify-center items-center">
                    <div className="text-center justify-start text-gray-600 text-sm font-medium font-['DM_Sans'] leading-5">Rooms &amp; Venues</div>
                </div>
                <div className="size- px-3 py-1.5 rounded-xl inline-flex flex-col justify-center items-center">
                    <div className="text-center justify-start text-gray-600 text-sm font-medium font-['DM_Sans'] leading-5">Amenities</div>
                </div>
                <div className="size- px-3 py-1.5 rounded-xl inline-flex flex-col justify-center items-center">
                    <div className="text-center justify-start text-gray-600 text-sm font-medium font-['DM_Sans'] leading-5">Contact</div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Link to="/login" className="size- px-3 py-1.5 bg-white rounded-xl outline outline-[0.80px] outline-offset-[-0.80px] outline-sky-700 flex justify-center items-center gap-1.5">
                    <div className="size-3 relative overflow-hidden">
                        <div className="w-[3.25px] h-2.5 left-[8.13px] top-[1.63px] absolute outline outline-1 outline-offset-[-0.54px] outline-sky-700" />
                        <div className="w-[2.71px] h-1.5 left-[5.42px] top-[3.79px] absolute outline outline-1 outline-offset-[-0.54px] outline-sky-700" />
                        <div className="w-1.5 h-0 left-[1.63px] top-[6.50px] absolute outline outline-1 outline-offset-[-0.54px] outline-sky-700" />
                    </div>
                    <div className="justify-start text-sky-700 text-xs font-medium font-['DM_Sans'] leading-4">Login</div>
                </Link>
                <Link to="/register" className="size- px-3 py-1.5 bg-sky-700 rounded-xl flex justify-center items-center gap-1.5">
                    <div className="size-3 relative overflow-hidden">
                        <div className="w-2 h-[3.25px] left-[1.08px] top-[8.13px] absolute outline outline-1 outline-offset-[-0.54px] outline-white" />
                        <div className="size-1 left-[2.71px] top-[1.63px] absolute outline outline-1 outline-offset-[-0.54px] outline-white" />
                        <div className="w-0 h-[3.25px] left-[10.29px] top-[4.33px] absolute outline outline-1 outline-offset-[-0.54px] outline-white" />
                        <div className="w-[3.25px] h-0 left-[8.67px] top-[5.96px] absolute outline outline-1 outline-offset-[-0.54px] outline-white" />
                    </div>
                    <div className="justify-start text-white text-xs font-medium font-['DM_Sans'] leading-4">Register</div>
                </Link>
            </div>
            </div>
        </header>
    );
}
