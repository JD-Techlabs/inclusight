import limits from "@app/config/scan-limits.json";
import { readScanConfig } from "@app/scanner-core/pure";
import { Alert, Card, CardHeader, PageHeader } from "@app/ui";
import { SlidersHorizontal, Trash2, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { DeletePropertyForm } from "@/components/properties/delete-property-form";
import { OwnerForm } from "@/components/properties/owner-form";
import { SettingsForm } from "@/components/properties/settings-form";
import { loadProperty } from "@/lib/load-property";
import { canManageProperties } from "@/lib/roles";

export const metadata: Metadata = { title: "Property settings" };

export default async function PropertySettingsPage(props: {
  params: Promise<{ propertyId: string }>;
}) {
  const { property, role, scope } = await loadProperty((await props.params).propertyId);
  const members = canManageProperties(role) ? await scope.members.list() : [];

  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: `/properties/${property.id}`, label: `Back to ${property.name}` }}
        title={`Settings: ${property.name}`}
      />

      {!canManageProperties(role) ? (
        <Alert variant="info">Only owners and admins can change property settings.</Alert>
      ) : (
        <div className="stagger max-w-2xl space-y-6">
          <section aria-labelledby="crawl-heading">
            <Card>
              <CardHeader
                id="crawl-heading"
                icon={SlidersHorizontal}
                title="Property and crawl settings"
              />
              <SettingsForm
                propertyId={property.id}
                name={property.name}
                isInvestorFacing={property.isInvestorFacing}
                verified={property.verified}
                config={readScanConfig(property.scanConfig)}
                maxPagesLimit={limits.maxPagesPerScan}
              />
            </Card>
          </section>
          <section aria-labelledby="owner-heading">
            <Card>
              <CardHeader id="owner-heading" icon={UserRound} title="Owner" />
              <OwnerForm
                propertyId={property.id}
                ownerId={property.ownerId}
                members={members.map((m) => ({ userId: m.userId, name: m.name }))}
              />
            </Card>
          </section>
          <section aria-labelledby="delete-heading">
            <Card className="border-destructive/40">
              <CardHeader id="delete-heading" icon={Trash2} title="Delete property" />
              <DeletePropertyForm propertyId={property.id} name={property.name} />
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}
