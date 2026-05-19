import type { Creative, Campaign } from "@prisma/client";
import { Field, TextArea, Select, FormError, enumOptions } from "@/components/form";

export function CreativeForm({
  action,
  campaigns,
  creative,
  defaultCampaignId,
  error,
}: {
  action: (formData: FormData) => void;
  campaigns: Pick<Campaign, "id" | "name">[];
  creative?: Creative;
  defaultCampaignId?: string;
  error?: string;
}) {
  return (
    <form action={action} className="card max-w-2xl space-y-4 p-6">
      <FormError message={error} />
      <Select
        label="Campaign"
        name="campaignId"
        required
        defaultValue={creative?.campaignId ?? defaultCampaignId}
        options={campaigns.map((c) => ({ value: c.id, label: c.name }))}
      />
      <Field
        label="Title"
        name="title"
        required
        defaultValue={creative?.title}
      />
      <TextArea
        label="Description"
        name="description"
        defaultValue={creative?.description}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Image URL"
          name="imageUrl"
          defaultValue={creative?.imageUrl}
          placeholder="https://cdn.example.com/ad.png"
        />
        <Field
          label="Video URL"
          name="videoUrl"
          defaultValue={creative?.videoUrl}
          placeholder="https://cdn.example.com/ad.mp4"
        />
        <Field
          label="Destination URL"
          name="destinationUrl"
          required
          defaultValue={creative?.destinationUrl}
          placeholder="https://advertiser.example.com"
        />
        <Field
          label="CTA Text"
          name="ctaText"
          defaultValue={creative?.ctaText}
          placeholder="Learn more"
        />
        <Select
          label="Creative Type"
          name="creativeType"
          options={enumOptions(["IMAGE", "VIDEO", "NATIVE", "HTML"])}
          defaultValue={creative?.creativeType}
        />
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Width"
            name="width"
            type="number"
            defaultValue={creative?.width ?? undefined}
          />
          <Field
            label="Height"
            name="height"
            type="number"
            defaultValue={creative?.height ?? undefined}
          />
        </div>
        <Select
          label="Approval Status"
          name="approvalStatus"
          options={enumOptions(["PENDING", "APPROVED", "REJECTED"])}
          defaultValue={creative?.approvalStatus}
        />
        <Select
          label="Status"
          name="status"
          options={enumOptions(["ACTIVE", "INACTIVE"])}
          defaultValue={creative?.status}
        />
      </div>
      <button type="submit" className="btn-primary">
        Save Creative
      </button>
    </form>
  );
}
