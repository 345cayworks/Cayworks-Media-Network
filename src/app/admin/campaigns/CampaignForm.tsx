import type { Campaign, Advertiser } from "@prisma/client";
import { Field, Select, FormError, enumOptions } from "@/components/form";

function dateValue(d?: Date): string | undefined {
  return d ? d.toISOString().slice(0, 10) : undefined;
}

// Sensible defaults for a brand-new campaign so the form is two fields, not ten.
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function plusDays(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
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
      <div className="-mt-2">
        <a
          href="/admin/advertisers/new?return=/admin/campaigns/new"
          className="text-xs font-medium text-brand-600 hover:underline"
        >
          + New advertiser
        </a>
      </div>
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
          defaultValue={dateValue(campaign?.startDate) ?? today()}
        />
        <Field
          label="End Date"
          name="endDate"
          type="date"
          required
          defaultValue={dateValue(campaign?.endDate) ?? plusDays(30)}
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
        <Field
          label="Frequency Cap (per user / hour)"
          name="frequencyCapPerUserPerHour"
          type="number"
          defaultValue={campaign?.frequencyCapPerUserPerHour ?? undefined}
          placeholder="optional — e.g. 1"
        />
        <Field
          label="Frequency Cap (per user / day)"
          name="frequencyCapPerUserPerDay"
          type="number"
          defaultValue={campaign?.frequencyCapPerUserPerDay ?? undefined}
          placeholder="optional — e.g. 3"
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
