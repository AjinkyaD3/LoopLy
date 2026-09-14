import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, padded = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border border-slate-200 bg-white shadow-sm",
          padded && "p-5 sm:p-6",
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

export default Card;
