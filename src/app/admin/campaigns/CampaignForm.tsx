import type { Campaign, Advertiser } from "@prisma/client";
import { Field, Select, FormError, enumOptions } from "@/components/form";

function dateValue(d?: Date): string | undefined {
  return d ? d.toISOString().slice(0, 10) : undefined;
}

export function CampaignForm({
  action,
  advertisers,
  campaign,
  defaultAdvertiserId,
  error,
}: {
  action: (formData: FormData) => void;
  advertisers: Pick<Advertiser, "id" | "businessName">[];
  campaign?: Campaign;
  defaultAdvertiserId?: string;
  error?: string;
}) {
  return (
    <form action={action} className="card max-w-2xl space-y-4 p-6">
      <FormError message={error} />
      <Select
        label="Advertiser"
        name="advertiserId"
        required
        defaultValue={campaign?.advertiserId ?? defaultAdvertiserId}
        options={advertisers.map((a) => ({
          value: a.id,
          label: a.businessName,
        }))}
      />
      <Field
        label="Campaign Name"
        name="name"
        required
        defaultValue={campaign?.name}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Objective"
          name="objective"
          options={enumOptions(["AWARENESS", "TRAFFIC", "LEADS", "CONVERSIONS"])}
          defaultValue={campaign?.objective}
        />
        <Select
          label="Pricing Model"
          name="pricingModel"
          options={enumOptions(["CPM", "CPC", "FLAT", "HOUSE"])}
          defaultValue={campaign?.pricingModel}
        />
        <Field
          label="Start Date"
          name="startDate"
          type="date"
          required
          defaultValue={dateValue(campaign?.startDate)}
        />
        <Field
          label="End Date"
          name="endDate"
          type="date"
          required
          defaultValue={dateValue(campaign?.endDate)}
        />
        <Field
          label="Budget (USD)"
          name="budget"
          type="number"
          step="0.01"
          defaultValue={campaign ? Number(campaign.budget) : 0}
        />
        <Field
          label="Priority (1–10)"
          name="priority"
          type="number"
          defaultValue={campaign?.priority ?? 5}
        />
        <Field
          label="Daily Impression Limit"
          name="dailyImpressionLimit"
          type="number"
          defaultValue={campaign?.dailyImpressionLimit ?? undefined}
          placeholder="optional"
        />
        <Field
          label="Total Impression Limit"
          name="totalImpressionLimit"
          type="number"
          defaultValue={campaign?.totalImpressionLimit ?? undefined}
          placeholder="optional"
        />
        <Select
          label="Status"
          name="status"
          options={enumOptions(["DRAFT", "ACTIVE", "PAUSED", "ENDED"])}
          defaultValue={campaign?.status}
        />
      </div>
      <button type="submit" className="btn-primary">
        Save Campaign
      </button>
    </form>
  );
}
