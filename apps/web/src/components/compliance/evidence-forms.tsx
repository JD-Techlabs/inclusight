"use client";

import { Button, fileInputClasses, Label, Textarea } from "@app/ui";
import { useEffect, useId, useRef } from "react";
import {
  deleteEvidenceAction,
  uploadEvidenceAction,
} from "@/app/(app)/properties/[propertyId]/manual-tests/actions";
import { FormStatus } from "@/components/form-status";
import { useFormAction } from "@/components/use-form-action";
import { EVIDENCE_ACCEPT } from "@/lib/compliance-input";

/** Upload a screenshot, recording or document as evidence for a criterion. */
export function EvidenceUploadForm(props: { propertyId: string; criterionId: string }) {
  const [state, onSubmit, pending] = useFormAction(uploadEvidenceAction);
  const errors = state?.fieldErrors ?? {};
  const form = useRef<HTMLFormElement>(null);
  const id = useId();

  // A successful upload clears the chosen file so it cannot be sent twice by accident.
  useEffect(() => {
    if (state?.success) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} onSubmit={onSubmit} className="space-y-4">
      <FormStatus state={state} />
      <input type="hidden" name="propertyId" value={props.propertyId} />
      <input type="hidden" name="criterionId" value={props.criterionId} />
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-file`}>File</Label>
        <input
          id={`${id}-file`}
          type="file"
          name="file"
          accept={EVIDENCE_ACCEPT}
          aria-describedby={`${id}-file-hint${errors.file ? ` ${id}-file-error` : ""}`}
          aria-invalid={errors.file ? true : undefined}
          className={fileInputClasses}
        />
        <p id={`${id}-file-hint`} className="text-sm text-muted-foreground">
          PNG, JPEG, WebP, PDF, MP4, WebM, TXT or CSV, up to 10 MB. Blur or remove personal data
          before uploading.
        </p>
        {errors.file ? (
          <p id={`${id}-file-error`} className="text-sm font-medium text-destructive">
            Error: {errors.file}
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-description`}>Description (optional)</Label>
        <Textarea
          id={`${id}-description`}
          name="description"
          rows={2}
          maxLength={500}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? `${id}-description-error` : undefined}
        />
        {errors.description ? (
          <p id={`${id}-description-error`} className="text-sm font-medium text-destructive">
            Error: {errors.description}
          </p>
        ) : null}
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Uploading…" : "Upload evidence"}
      </Button>
    </form>
  );
}

/** Deletes one evidence file; the button names the file so it is clear out of context. */
export function DeleteEvidenceButton(props: { evidenceId: string; fileName: string }) {
  const [state, onSubmit, pending] = useFormAction(deleteEvidenceAction);
  return (
    <form onSubmit={onSubmit} className="inline">
      <input type="hidden" name="evidenceId" value={props.evidenceId} />
      <Button type="submit" variant="link" disabled={pending}>
        Delete<span className="sr-only"> {props.fileName}</span>
      </Button>
      {state?.error ? <FormStatus state={state} /> : null}
    </form>
  );
}
