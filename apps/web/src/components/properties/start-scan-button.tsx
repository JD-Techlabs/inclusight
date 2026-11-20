"use client";

import { Button } from "@app/ui";
import { startScanAction } from "@/app/(app)/properties/actions";
import { FormStatus } from "@/components/form-status";
import { useFormAction } from "@/components/use-form-action";

export function StartScanButton(props: { propertyId: string; verified: boolean }) {
  const [state, onSubmit, pending] = useFormAction(startScanAction);

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <FormStatus state={state} />
      <input type="hidden" name="propertyId" value={props.propertyId} />
      <Button type="submit" disabled={pending}>
        {pending ? "Starting…" : props.verified ? "Start full scan" : "Scan this page"}
      </Button>
    </form>
  );
}
