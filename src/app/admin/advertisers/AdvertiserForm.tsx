import type { Advertiser } from "@prisma/client";
import { Field, TextArea, Select, FormError, enumOptions } from "@/components/form";

export function AdvertiserForm({
  action,
  advertiser,
  error,
}: {
  action: (formData: FormData) => void;
  advertiser?: Advertiser;
  error?: string;
}) {
  return (
    <form action={action} className="card max-w-2xl space-y-4 p-6">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Business Name"
          name="businessName"
          required
          defaultValue={advertiser?.businessName}
        />
        <Field
          label="Contact Name"
          name="contactName"
          required
          defaultValue={advertiser?.contactName}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          required
          defaultValue={advertiser?.email}
        />
        <Field label="Phone" name="phone" defaultValue={advertiser?.phone} />
        <Field
          label="Website"
          name="website"
          defaultValue={advertiser?.website}
          placeholder="https://example.com"
        />
        <Field
          label="Industry / Category"
          name="industry"
          defaultValue={advertiser?.industry}
          placeholder="insurance"
        />
        <Select
          label="Billing Status"
          name="billingStatus"
          options={enumOptions(["CURRENT", "PAST_DUE", "ON_HOLD"])}
          defaultValue={advertiser?.billingStatus}
        />
        <Select
          label="Status"
          name="status"
          options={enumOptions(["ACTIVE", "INACTIVE", "PROSPECT"])}
          defaultValue={advertiser?.status}
        />
      </div>
      <TextArea label="Notes" name="notes" defaultValue={advertiser?.notes} />
      <div className="flex gap-2">
        <button type="submit" className="btn-primary">
          Save Advertiser
        </button>
      </div>
    </form>
  );
}
