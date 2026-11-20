import type { ComponentProps } from "react";
import { cn } from "./cn";

/** Shared look for text inputs, selects and text areas. Focus keeps the global outline. */
export const controlClasses = [
  "block min-h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-xs",
  "transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground",
  "focus-visible:border-primary focus-visible:shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_18%,transparent)]",
  "aria-[invalid=true]:border-2 aria-[invalid=true]:border-destructive",
  "disabled:cursor-not-allowed disabled:opacity-60",
].join(" ");

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlClasses, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(controlClasses, "select-chevron", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlClasses, "min-h-20", className)} {...props} />;
}

/**
 * A radio button or checkbox with its label (and hint) in a selectable card. The native control
 * still shows the checked state; the border and tint only reinforce it.
 */
export const choiceCardClasses = [
  "flex items-start gap-3 rounded-lg border border-border-subtle bg-card p-3 [&>input]:shrink-0",
  "transition-[background-color,border-color] duration-150 hover:bg-muted/50",
  "has-checked:border-primary has-checked:bg-primary-soft/50",
].join(" ");

/** Native file picker with a button-like "choose file" part. */
export const fileInputClasses = [
  "block w-full text-sm text-muted-foreground",
  "file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-lg file:border file:border-border file:bg-card file:px-4 file:py-2",
  "file:text-sm file:font-medium file:text-foreground file:transition-colors hover:file:bg-muted",
].join(" ");
