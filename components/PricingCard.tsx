import { cn } from "@/lib/cn";

interface PricingCardProps {
  name: string;
  price: number;
  features: string[];
  highlighted?: boolean;
  priceId?: string;
}

export function PricingCard({ name, price, features, highlighted = false }: PricingCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl p-8 ring-1",
        highlighted
          ? "bg-brand-600 ring-brand-600 text-white"
          : "bg-white ring-gray-200 text-gray-900"
      )}
    >
      <h3 className={cn("text-lg font-semibold", highlighted ? "text-white" : "text-gray-900")}>
        {name}
      </h3>
      <div className="mt-4 flex items-baseline gap-x-2">
        <span className={cn("text-4xl font-bold tracking-tight", highlighted ? "text-white" : "text-gray-900")}>
          ${price}
        </span>
        <span className={cn("text-sm font-semibold", highlighted ? "text-brand-200" : "text-gray-500")}>
          /month
        </span>
      </div>
      <ul className="mt-8 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-3">
            <span className={cn("mt-0.5 text-sm", highlighted ? "text-brand-200" : "text-green-600")}>✓</span>
            <span className={cn("text-sm", highlighted ? "text-brand-100" : "text-gray-600")}>{f}</span>
          </li>
        ))}
      </ul>
      <a
        href="#waitlist"
        className={cn(
          "mt-8 block rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors",
          highlighted
            ? "bg-white text-brand-600 hover:bg-brand-50"
            : "bg-brand-600 text-white hover:bg-brand-700"
        )}
      >
        Get Early Access
      </a>
    </div>
  );
}
