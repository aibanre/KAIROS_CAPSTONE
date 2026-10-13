import { Link } from "react-router";
import logo from "../../assets/images/logo/transparent-kaiazul.png";
import { name as brandName } from "../../config/brand";

const sizeClasses = {
  sm: { image: "h-8 w-8", text: "text-sm", subtitle: "text-[0.65rem]" },
  md: { image: "h-10 w-10", text: "text-lg", subtitle: "text-xs" },
  lg: { image: "h-12 w-12", text: "text-xl", subtitle: "text-xs" },
};

export default function BrandLogo({ size = "md", collapsed = false, linkTo = "/portal" }) {
  const classes = sizeClasses[size] || sizeClasses.md;
  const content = (
    <>
      <span className={`grid shrink-0 place-items-center rounded-xl bg-white p-1 shadow-sm ${classes.image}`}>
        <img src={logo} alt={brandName} className="h-full w-full object-contain" />
      </span>
      {!collapsed && (
        <span className="min-w-0">
          <span className={`block truncate font-serif font-bold text-current ${classes.text}`}>{brandName}</span>
          <span className={`block text-current/55 ${classes.subtitle}`}>Customer portal</span>
        </span>
      )}
    </>
  );

  if (linkTo === null) {
    return <span className="flex min-w-0 items-center gap-3">{content}</span>;
  }

  return (
    <Link to={linkTo} className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
      {content}
    </Link>
  );
}
