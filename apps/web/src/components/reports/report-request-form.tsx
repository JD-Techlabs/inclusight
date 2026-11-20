"use client";

import type { ReportTypeId } from "@app/compliance-data";
import { Button, choiceCardClasses, Label, SelectField, Textarea, TextField } from "@app/ui";
import { useId, useState } from "react";
import { requestReportAction } from "@/app/(app)/reports/actions";
import { FormStatus } from "@/components/form-status";
import { useFormAction } from "@/components/use-form-action";

type Option = { id: string; name: string };

/** Chooses a report type and the details it needs, then queues it for generation. */
export function ReportRequestForm(props: {
  types: Array<{ type: ReportTypeId; title: string; summary: string }>;
  audits: Option[];
  properties: Option[];
  defaultFinancialYear: string;
  initialType?: ReportTypeId;
  initialAuditId?: string;
}) {
  const [state, onSubmit, pending] = useFormAction(requestReportAction);
  const [type, setType] = useState<ReportTypeId>(props.initialType ?? props.types[0]!.type);
  const errors = state?.fieldErrors ?? {};
  const id = useId();

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <FormStatus state={state} />
      <fieldset className="space-y-2">
        <legend className="mb-2 font-medium">Report</legend>
        {props.types.map((option) => (
          <div key={option.type} className={choiceCardClasses}>
            <input
              type="radio"
              id={`${id}-${option.type}`}
              name="type"
              value={option.type}
              checked={type === option.type}
              onChange={() => setType(option.type)}
              aria-describedby={`${id}-${option.type}-hint`}
              className="mt-0.5 h-5 w-5"
            />
            <div>
              <Label htmlFor={`${id}-${option.type}`}>{option.title}</Label>
              <p id={`${id}-${option.type}-hint`} className="text-sm text-muted-foreground">
                {option.summary}
              </p>
            </div>
          </div>
        ))}
      </fieldset>

      {type === "audit_summary" ? (
        <SelectField
          label="Audit"
          name="auditId"
          defaultValue={props.initialAuditId ?? ""}
          error={errors.auditId}
        >
          <option value="">Choose an audit</option>
          {props.audits.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </SelectField>
      ) : null}

      {type === "remediation_tracker" ? (
        <fieldset
          className="space-y-2"
          aria-describedby={errors.propertyIds ? `${id}-p-error` : undefined}
        >
          <legend className="font-medium">Properties</legend>
          {props.properties.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`${id}-p-${p.id}`}
                name="propertyIds"
                value={p.id}
                defaultChecked
                className="h-5 w-5"
              />
              <Label htmlFor={`${id}-p-${p.id}`}>{p.name}</Label>
            </div>
          ))}
          {errors.propertyIds ? (
            <p id={`${id}-p-error`} className="text-sm font-medium text-destructive">
              Error: {errors.propertyIds}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {type === "sebi_annual" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Financial year"
            name="financialYear"
            defaultValue={props.defaultFinancialYear}
            hint="For example 2025-26"
            error={errors.financialYear}
          />
          <div className="hidden sm:block" />
          <TextField
            label="CEO's name (optional)"
            name="ceoName"
            autoComplete="off"
            error={errors.ceoName}
            hint="Printed in the signature block"
          />
          <TextField
            label="CTO's name (optional)"
            name="ctoName"
            autoComplete="off"
            error={errors.ctoName}
            hint="Printed in the signature block"
          />
        </div>
      ) : null}

      {type === "accessibility_statement" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Property" name="propertyId" defaultValue="" error={errors.propertyId}>
            <option value="">Choose a property</option>
            {props.properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Standard"
            name="standardId"
            defaultValue="wcag21aa"
            error={errors.standardId}
          >
            <option value="wcag21aa">WCAG 2.1 Level AA</option>
            <option value="wcag22aa">WCAG 2.2 Level AA</option>
          </SelectField>
          <TextField
            label="Feedback email address"
            name="contactEmail"
            type="email"
            autoComplete="off"
            error={errors.contactEmail}
            hint="Published in the statement"
          />
          <TextField
            label="Feedback phone number (optional)"
            name="contactPhone"
            type="tel"
            autoComplete="off"
            error={errors.contactPhone}
          />
          <TextField
            label="Response time in working days"
            name="responseDays"
            type="number"
            min={1}
            max={60}
            defaultValue={7}
            error={errors.responseDays}
          />
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`${id}-limitations`}>Other known limitations (optional)</Label>
            <Textarea
              id={`${id}-limitations`}
              name="limitationsNote"
              rows={3}
              maxLength={2000}
              aria-describedby={`${id}-limitations-hint`}
            />
            <p id={`${id}-limitations-hint`} className="text-sm text-muted-foreground">
              Problems you know about that are not in the results, and any alternatives you offer.
            </p>
          </div>
        </div>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Starting…" : "Generate report"}
      </Button>
    </form>
  );
}
