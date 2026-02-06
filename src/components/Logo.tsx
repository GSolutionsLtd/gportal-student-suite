import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "default" | "light";
  showText?: boolean;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
};

const textSizeClasses = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
};

export function Logo({ size = "md", variant = "default", showText = true }: LogoProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex items-center justify-center rounded-xl gradient-primary shadow-md",
          sizeClasses[size]
        )}
      >
        <GraduationCap 
          className={cn(
            "text-primary-foreground",
            size === "sm" ? "h-4 w-4" : size === "md" ? "h-5 w-5" : "h-7 w-7"
          )} 
        />
      </div>
      {showText && (
        <div className="flex flex-col">
          <span
            className={cn(
              "font-bold tracking-tight leading-none",
              textSizeClasses[size],
              variant === "light" ? "text-primary-foreground" : "text-foreground"
            )}
          >
            GPortal
          </span>
          <span
            className={cn(
              "text-xs font-medium tracking-wide uppercase",
              variant === "light" ? "text-primary-foreground/70" : "text-muted-foreground"
            )}
          >
            Suite
          </span>
        </div>
      )}
    </div>
  );
}
