"use client";

import { ISSUE_STATUSES } from "@app/db/domain";
import { Alert, Button, Label, SelectField, Textarea, TextField } from "@app/ui";
import { useId, type ReactNode } from "react";
import { updateIssuesAction } from "@/app/(app)/properties/[propertyId]/issues/actions";
import { FormStatus } from "@/components/form-status";
import { useFormAction } from "@/components/use-form-action";
import { ISSUE_STATUS_LABELS } from "@/lib/labels";

type Member = { userId: string; name: string };

/**
 * Status / assignee / target date change for one issue (pass `issueIds`) or many (render checkboxes named
 * "issueIds" as children). A reason is required for false positive and accepted risk.
 */
export function IssueTriageForm(props: {
  members: Member[];
  issueIds?: string[];
  legend: string;
  children?: ReactNode;
}) {
  const [state, onSubmit, pending] = useFormAction(updateIssuesAction);
  const errors = state?.fieldErrors ?? {};
  const reasonId = useId();
  const clearId = useId();

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormStatus state={state} />
      {errors.issueIds ? <Alert variant="error">{errors.issueIds}</Alert> : null}
      {props.children}
      {props.issueIds?.map((id) => (
        <input key={id} type="hidden" name="issueIds" value={id} />
      ))}
      <fieldset className="space-y-4 rounded-xl border border-border-subtle bg-card p-5 shadow-card">
        <legend className="rounded-md bg-card px-2 text-sm font-semibold">{props.legend}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="New status" name="status" defaultValue="" error={errors.status}>
            <option value="">No change</option>
            {ISSUE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {ISSUE_STATUS_LABELS[status]}
              </option>
            ))}
          </SelectField>
          <SelectField label="Assign to" name="assignee" defaultValue="">
            <option value="">No change</option>
            <option value="none">Nobody (unassign)</option>
            {props.members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Target date"
            name="targetDate"
            type="date"
            hint="When the fix is due (remediation tracker)."
            error={errors.targetDate}
          />
          <div className="flex items-center gap-2 self-end pb-2">
            <input id={clearId} type="checkbox" name="clearTargetDate" className="h-5 w-5" />
            <Label htmlFor={clearId}>Remove the target date</Label>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={reasonId}>Reason</Label>
          <Textarea
            id={reasonId}
            name="reason"
            rows={2}
            maxLength={1000}
            aria-describedby={`${reasonId}-hint${errors.reason ? ` ${reasonId}-error` : ""}`}
            aria-invalid={errors.reason ? true : undefined}
          />
          <p id={`${reasonId}-hint`} className="text-sm text-muted-foreground">
            Required for False positive and Accepted risk. Recorded in the audit log.
          </p>
          {errors.reason ? (
            <p id={`${reasonId}-error`} className="text-sm font-medium text-destructive">
              Error: {errors.reason}
            </p>
          ) : null}
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Apply"}
        </Button>
      </fieldset>
    </form>
  );
}
