"use client";

import { Button, Label, SelectField, Textarea, TextField } from "@app/ui";
import { useId } from "react";
import { createAuditAction, updateAuditAction } from "@/app/(app)/audits/actions";
import { FormStatus } from "@/components/form-status";
import { useFormAction } from "@/components/use-form-action";

export type AuditFormValues = {
  title: string;
  auditorName: string;
  iaapCertId: string;
  auditorOrg: string;
  startDate: string;
  endDate: string;
  standardId: string;
  propertyIds: string[];
  methodology: string;
};

const EMPTY: AuditFormValues = {
  title: "",
  auditorName: "",
  iaapCertId: "",
  auditorOrg: "",
  startDate: "",
  endDate: "",
  standardId: "wcag21aa",
  propertyIds: [],
  methodology: "",
};

/** Create an audit, or edit one that is in progress (pass `auditId`). */
export function AuditForm(props: {
  properties: Array<{ id: string; name: string }>;
  auditId?: string;
  values?: AuditFormValues;
}) {
  const [state, onSubmit, pending] = useFormAction(
    props.auditId ? updateAuditAction : createAuditAction,
  );
  const errors = state?.fieldErrors ?? {};
  const values = props.values ?? EMPTY;
  const id = useId();

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormStatus state={state} />
      {props.auditId ? <input type="hidden" name="auditId" value={props.auditId} /> : null}
      <TextField
        label="Audit title"
        name="title"
        required
        defaultValue={values.title}
        error={errors.title}
        hint="For example: FY 2026-27 annual accessibility audit"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Auditor's name"
          name="auditorName"
          required
          autoComplete="off"
          defaultValue={values.auditorName}
          error={errors.auditorName}
        />
        <TextField
          label="IAAP certification number"
          name="iaapCertId"
          required
          autoComplete="off"
          defaultValue={values.iaapCertId}
          error={errors.iaapCertId}
          hint="The auditor's IAAP certification (for example CPACC or WAS)"
        />
        <TextField
          label="Auditor's organisation"
          name="auditorOrg"
          required
          defaultValue={values.auditorOrg}
          error={errors.auditorOrg}
        />
        <SelectField
          label="Standard"
          name="standardId"
          defaultValue={values.standardId}
          error={errors.standardId}
          hint="GIGW 3.0 and IS 17802 are reported alongside it."
        >
          <option value="wcag21aa">WCAG 2.1 Level AA (referenced by SEBI)</option>
          <option value="wcag22aa">WCAG 2.2 Level AA</option>
        </SelectField>
        <TextField
          label="Start date"
          name="startDate"
          type="date"
          required
          defaultValue={values.startDate}
          error={errors.startDate}
        />
        <TextField
          label="End date (optional)"
          name="endDate"
          type="date"
          defaultValue={values.endDate}
          error={errors.endDate}
        />
      </div>
      <fieldset
        className="space-y-2"
        aria-describedby={errors.propertyIds ? `${id}-scope-error` : undefined}
      >
        <legend className="font-medium">Properties in scope</legend>
        {props.properties.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add a property first.</p>
        ) : (
          props.properties.map((property) => (
            <div key={property.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`${id}-${property.id}`}
                name="propertyIds"
                value={property.id}
                defaultChecked={values.propertyIds.includes(property.id)}
                className="h-5 w-5"
              />
              <Label htmlFor={`${id}-${property.id}`}>{property.name}</Label>
            </div>
          ))
        )}
        {errors.propertyIds ? (
          <p id={`${id}-scope-error`} className="text-sm font-medium text-destructive">
            Error: {errors.propertyIds}
          </p>
        ) : null}
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-methodology`}>Methodology notes (optional)</Label>
        <Textarea
          id={`${id}-methodology`}
          name="methodology"
          rows={4}
          maxLength={5000}
          defaultValue={values.methodology}
          aria-describedby={`${id}-methodology-hint`}
        />
        <p id={`${id}-methodology-hint`} className="text-sm text-muted-foreground">
          Added to the standard methodology in the audit summary: browsers and assistive
          technologies used, sample of pages, and any limits on scope.
        </p>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : props.auditId ? "Save audit details" : "Create audit"}
      </Button>
    </form>
  );
}
