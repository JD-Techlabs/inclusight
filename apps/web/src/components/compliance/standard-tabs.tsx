import { listStandards, PENDING_REVIEW_LABEL } from "@app/compliance-data";
import { TabNav } from "@app/ui";

/** Links between the standards a matrix can be shown against; the current one is marked. */
export function StandardTabs(props: { current: string; hrefFor: (standardId: string) => string }) {
  return (
    <TabNav
      label="Standard"
      items={listStandards().map((standard) => ({
        key: standard.id,
        href: props.hrefFor(standard.id),
        current: props.current === standard.id,
        label: (
          <>
            {standard.shortName}{" "}
            {standard.pendingReview ? (
              <span className="text-xs font-normal text-muted-foreground">
                ({PENDING_REVIEW_LABEL.toLowerCase()})
              </span>
            ) : null}
          </>
        ),
      }))}
    />
  );
}
