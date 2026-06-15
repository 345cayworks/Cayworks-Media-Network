import { PageHeader } from "@/components/ui";
import { requireRole, ADMIN_ROLES } from "@/lib/auth";
import { AdvertiserForm } from "../AdvertiserForm";
import { createAdvertiser } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewAdvertiserPage({
  searchParams,
}: {
  searchParams: { error?: string; return?: string };
}) {
  await requireRole(ADMIN_ROLES);
  const action = async (formData: FormData) => {
    "use server";
    if (searchParams.return) formData.set("return", searchParams.return);
    await createAdvertiser(formData);
  };
  return (
    <div>
      <PageHeader
        title="New Advertiser"
        subtitle={
          searchParams.return
            ? "You'll be returned to the previous page once saved."
            : undefined
        }
      />
      <AdvertiserForm action={action} error={searchParams.error} />
    </div>
  );
}
