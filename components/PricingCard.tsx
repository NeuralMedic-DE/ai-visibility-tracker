import { cn } from "@/lib/cn";
import { CheckoutButton } from "./CheckoutButton";

interface PricingCardProps {
  name: string;
  price: number;
  features: string[];
  highlighted?: boolean;
  plan: "starter" | "pro";
  /** Show trial badge */
  showTrial?: boolean;
}

export function PricingCard({
  name,
  price,
  features,
  highlighted = false,
  plan,
  showTrial = true,
}: PricingCardProps) {
  return (
    <div
      className={cn(
        "relative rounded-2xl p-8 ring-1 flex flex-col",
        highlighted
          ? "bg-brand-600 ring-brand-600 text-white"
          : "bg-white ring-gray-200 text-gray-900"
      )}
    >
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-amber-900 shadow-sm">
            Most Popular
          </span>
        </div>
      )}

      <h3
        className={cn(
          "text-lg font-semibold",
          highlighted ? "text-white" : "text-gray-900"
        )}
      >
        {name}
      </h3>

      <div className="mt-4 flex items-baseline gap-x-2">
        <span
          className={cn(
            "text-4xl font-bold tracking-tight",
            highlighted ? "text-white" : "text-gray-900"
          )}
        >
          ${price}
        </span>
        <span
          className={cn(
            "text-sm font-semibold",
            highlighted ? "text-brand-200" : "text-gray-500"
          )}
        >
          /month
        </span>
      </div>

      {showTrial && (
        <p
          className={cn(
            "mt-1 text-xs",
            highlighted ? "text-brand-200" : "text-green-600 font-medium"
          )}
        >
          14-day free trial — no credit card billed until day 15
        </p>
      )}

      <ul className="mt-8 space-y-3 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 text-sm shrink-0",
                highlighted ? "text-brand-200" : "text-green-600"
              )}
            >
              ✓
            </span>
            <span
              className={cn(
                "text-sm",
                highlighted ? "text-brand-100" : "text-gray-600"
              )}
            >
              {f}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <CheckoutButton
          plan={plan}
          label={`Start ${name} — $${price}/mo`}
          className={cn(
            highlighted
              ? "bg-white text-brand-600 hover:bg-brand-50"
              : "bg-brand-600 text-white hover:bg-brand-700"
          )}
        />
      </div>
    </div>
  );
}
