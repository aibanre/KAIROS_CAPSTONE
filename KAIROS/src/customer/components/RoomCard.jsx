import { Link } from "react-router";
import formatCurrency from "../utils/formatCurrency";
import StarRating from "../../shared/StarRating";
import { compactCardButton, compactCardContent, compactCardImage, compactCardInfo, compactCardPrice, compactCardShell, compactCardThumbnail, compactCardTitle } from "./compactCardClasses";
import ResourceImage from "../../shared/ResourceImage";

export default function RoomCard({ room }) {
  return (
    <article className={`${compactCardShell} sm:block sm:rounded-3xl sm:p-0`}>
      <div className={`${compactCardThumbnail} sm:w-full sm:rounded-none`}>
        <ResourceImage src={room.image} alt={room.name} name={room.name} type="room" wrapperClassName="aspect-[4/3] sm:aspect-[16/10] sm:max-h-58" className={`${compactCardImage} sm:h-auto`} />
        <span className="absolute left-4 top-4 hidden rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-navy backdrop-blur sm:block">{room.type}</span>
      </div>
      <div className={`${compactCardContent} sm:block sm:p-5`}>
        <span className="mb-1 inline-flex self-start rounded-full bg-tint px-2 py-0.5 text-[10px] font-bold text-primary sm:hidden">{room.type}</span>
        <div className="min-w-0 sm:flex sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <h3 className={`${compactCardTitle} sm:text-xl`}>{room.name}</h3>
            <p className={`${compactCardInfo} sm:mt-1 sm:text-sm`}>{room.bed} · Up to {room.capacity} guests</p>
          </div>
          <div className="mt-1 text-xs [&>span]:text-xs sm:mt-0 sm:text-sm sm:[&>span]:text-sm"><StarRating value={room.rating} reviewCount={room.reviewCount} /></div>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 sm:mt-5 sm:items-end">
          <p className="truncate"><span className={`${compactCardPrice} sm:text-xl`}>{formatCurrency(room.price)}</span><span className="text-xs text-slate sm:text-sm"> / night</span></p>
          <Link aria-label="View room" className={`${compactCardButton} sm:h-auto sm:w-auto sm:rounded-xl sm:px-4 sm:py-2.5`} to={`/portal/rooms/${room.id}`}>View<span className="sr-only"> room</span></Link>
        </div>
      </div>
    </article>
  );
}
