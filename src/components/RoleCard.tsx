import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { Button } from "./ui/button";

interface RoleCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  color: "primary" | "accent" | "success" | "warning";
  onClick: () => void;
  delay?: number;
}

const colorClasses = {
  primary: "bg-primary/10 text-primary group-hover:bg-primary",
  accent: "bg-accent/10 text-accent group-hover:bg-accent",
  success: "bg-success/10 text-success group-hover:bg-success",
  warning: "bg-warning/10 text-warning group-hover:bg-warning",
};

const buttonVariants = {
  primary: "default",
  accent: "accent",
  success: "success",
  warning: "default",
} as const;

export const RoleCard = React.forwardRef<HTMLDivElement, RoleCardProps>(
  ({ icon: Icon, title, description, color, onClick, delay = 0 }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "group relative p-6 rounded-2xl bg-card border border-border/50",
          "hover:shadow-xl hover:border-primary/30 transition-all duration-300",
          "animate-slide-up cursor-pointer"
        )}
        style={{ animationDelay: `${delay}ms` }}
        onClick={onClick}
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className={cn(
            "p-4 rounded-2xl transition-all duration-300 group-hover:text-primary-foreground group-hover:scale-110",
            colorClasses[color]
          )}>
            <Icon className="h-8 w-8" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-foreground mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">{description}</p>
          </div>
          <Button variant={buttonVariants[color]} size="sm" className="w-full">
            Sign In as {title}
          </Button>
        </div>
      </div>
    );
  }
);
RoleCard.displayName = "RoleCard";
