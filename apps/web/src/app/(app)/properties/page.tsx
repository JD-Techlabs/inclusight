import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  TableContainer,
  tableClass,
  td,
  th,
} from "@app/ui";
import { BadgeCheck, CircleDashed, Globe, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AddPropertyForm } from "@/components/properties/add-property-form";
import { canManageProperties } from "@/lib/roles";
import { requireAppContext } from "@/lib/session";

export const metadata: Metadata = { title: "Properties" };

export default async function PropertiesPage() {
  const { role, scope } = await requireAppContext();
  const properties = await scope.properties.list();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Properties"
        description="A property is a website you check for accessibility. Verify that you control its domain to scan the whole site; until then only the start page can be scanned."
      />

      {properties.length === 0 ? (
        <EmptyState icon={Globe} title="No properties yet.">
          Add your first website below to run an accessibility scan.
        </EmptyState>
      ) : (
        <TableContainer>
          <table className={tableClass}>
            <caption className="sr-only">Properties in this organisation</caption>
            <thead>
              <tr>
                <th scope="col" className={th}>
                  Name
                </th>
                <th scope="col" className={th}>
                  Website
                </th>
                <th scope="col" className={th}>
                  Domain
                </th>
                <th scope="col" className={th}>
                  Investor-facing
                </th>
              </tr>
            </thead>
            <tbody>
              {properties.map((property) => (
                <tr key={property.id}>
                  <th scope="row" className={`${td} text-left font-medium`}>
                    <span className="flex items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                        <Globe className="size-4" />
                      </span>
                      <Link className="text-primary underline" href={`/properties/${property.id}`}>
                        {property.name}
                      </Link>
                    </span>
                  </th>
                  <td className={`${td} break-all text-muted-foreground`}>{property.baseUrl}</td>
                  <td className={td}>
                    {property.verified ? (
                      <Badge tone="success" icon={BadgeCheck}>
                        Verified
                      </Badge>
                    ) : (
                      <Badge icon={CircleDashed}>Not verified</Badge>
                    )}
                  </td>
                  <td className={td}>{property.isInvestorFacing ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableContainer>
      )}

      {canManageProperties(role) ? (
        <section aria-labelledby="add-property-heading">
          <Card className="max-w-2xl">
            <CardHeader
              id="add-property-heading"
              icon={Plus}
              title="Add a property"
              description="Name the website and give its start address."
            />
            <AddPropertyForm />
          </Card>
        </section>
      ) : null}
    </div>
  );
}
