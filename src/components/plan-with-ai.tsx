import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Contextual entry point into HostPulse Planner AI.
 * Encodes minimal seed context in the URL so the planner can pre-fill.
 */
export function PlanWithAI({
  seed,
  label = "Plan with AI",
  variant = "outline",
  size = "sm",
  className,
}: {
  seed?: Record<string, string | number | undefined | null>;
  label?: string;
  variant?: "outline" | "default" | "secondary" | "ghost";
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
}) {
  const search: Record<string, string> = {};
  if (seed) {
    for (const [k, v] of Object.entries(seed)) {
      if (v === null || v === undefined || v === "") continue;
      search[k] = String(v);
    }
  }
  return (
    <Button asChild variant={variant} size={size} className={cn("gap-1.5", className)}>
      <Link to="/planner" search={search as never}>
        <Sparkles className="h-4 w-4" aria-hidden />
        <span>{label}</span>
      </Link>
    </Button>
  );
}
