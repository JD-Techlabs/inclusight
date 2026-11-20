"use client";

import type { ScanConfig } from "@app/scanner-core/pure";
import { Button, Label, SelectField, Textarea, TextField } from "@app/ui";
import { updatePropertySettingsAction } from "@/app/(app)/properties/actions";
import { FormStatus } from "@/components/form-status";
import { useFormAction } from "@/components/use-form-action";
import { VIEWPORT_LABELS } from "@/lib/labels";

type Props = {
  propertyId: string;
  name: string;
  isInvestorFacing: boolean;
  verified: boolean;
  config: ScanConfig;
  maxPagesLimit: number;
};

function TextArea(props: { name: string; label: string; hint: string; defaultValue: string }) {
  const id = `field-${props.name}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{props.label}</Label>
      <Textarea
        id={id}
        name={props.name}
        rows={3}
        defaultValue={props.defaultValue}
        aria-describedby={`${id}-hint`}
        className="font-mono"
      />
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        {props.hint}
      </p>
    </div>
  );
}

export function SettingsForm(props: Props) {
  const [state, onSubmit, pending] = useFormAction(updatePropertySettingsAction);
  const errors = state?.fieldErrors ?? {};

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormStatus state={state} />
      <input type="hidden" name="propertyId" value={props.propertyId} />
      <TextField label="Name" name="name" defaultValue={props.name} required error={errors.name} />
      <div className="flex items-start gap-2">
        <input
          id="isInvestorFacing"
          name="isInvestorFacing"
          type="checkbox"
          defaultChecked={props.isInvestorFacing}
          className="mt-1 h-5 w-5"
        />
        <label htmlFor="isInvestorFacing" className="text-sm">
          Investor-facing
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Maximum pages per scan"
          name="maxPages"
          type="number"
          min={1}
          max={props.maxPagesLimit}
          defaultValue={props.config.maxPages}
          hint={`Up to ${props.maxPagesLimit}.`}
          error={errors.maxPages}
        />
        <TextField
          label="Maximum link depth"
          name="maxDepth"
          type="number"
          min={0}
          max={20}
          defaultValue={props.config.maxDepth}
          hint="Clicks away from the start page (0–20)."
          error={errors.maxDepth}
        />
      </div>

      <TextArea
        name="include"
        label="Only include paths matching"
        hint="One pattern per line, e.g. /investors/**. Leave empty to include everything."
        defaultValue={props.config.include.join("\n")}
      />
      <TextArea
        name="exclude"
        label="Exclude paths matching"
        hint="One pattern per line, e.g. /blog/**. * matches within a path segment, ** across segments."
        defaultValue={props.config.exclude.join("\n")}
      />

      <SelectField
        label="Query strings"
        name="queryStrings"
        defaultValue={props.config.queryStrings}
      >
        <option value="strip">Ignore (treat /page?a=1 and /page?a=2 as one page)</option>
        <option value="keep">Keep (treat them as different pages)</option>
      </SelectField>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Viewports</legend>
        {(["desktop", "mobile"] as const).map((viewport) => (
          <div key={viewport} className="flex items-center gap-2">
            <input
              id={`viewport-${viewport}`}
              type="checkbox"
              name="viewports"
              value={viewport}
              defaultChecked={props.config.viewports.includes(viewport)}
              className="h-5 w-5"
            />
            <label htmlFor={`viewport-${viewport}`} className="text-sm">
              {VIEWPORT_LABELS[viewport]}
            </label>
          </div>
        ))}
        {errors.viewports ? (
          <p className="text-sm font-medium text-destructive">Error: {errors.viewports}</p>
        ) : null}
      </fieldset>

      <TextField
        label="Wait for element (optional)"
        name="waitSelector"
        defaultValue={props.config.waitSelector ?? ""}
        hint="A CSS selector to wait for before checking, for pages that load content late."
      />

      <div className="flex items-start gap-2">
        <input
          id="respectRobots"
          name="respectRobots"
          type="checkbox"
          defaultChecked={props.config.respectRobots}
          disabled={!props.verified}
          aria-describedby="respectRobots-hint"
          className="mt-1 h-5 w-5"
        />
        <div>
          <label htmlFor="respectRobots" className="text-sm">
            Obey robots.txt
          </label>
          <p id="respectRobots-hint" className="text-sm text-muted-foreground">
            {props.verified
              ? "Untick only for your own verified site if robots.txt blocks pages you want checked."
              : "Always on until the domain is verified."}
          </p>
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
