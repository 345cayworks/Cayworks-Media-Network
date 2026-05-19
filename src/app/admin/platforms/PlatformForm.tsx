import type { Platform } from "@prisma/client";
import { Field, TextArea, Select, FormError, enumOptions } from "@/components/form";

export function PlatformForm({
  action,
  platform,
  error,
}: {
  action: (formData: FormData) => void;
  platform?: Platform;
  error?: string;
}) {
  return (
    <form action={action} className="card max-w-2xl space-y-4 p-6">
      <FormError message={error} />
      <Field
        label="Platform Name"
        name="name"
        required
        defaultValue={platform?.name}
        placeholder="CayRentManager"
      />
      <Field
        label="Slug"
        name="slug"
        required
        defaultValue={platform?.slug}
        placeholder="cayrentmanager"
      />
      <Select
        label="Status"
        name="status"
        options={enumOptions(["ACTIVE", "INACTIVE"])}
        defaultValue={platform?.status}
      />
      <TextArea
        label="Allowed Domains (comma or newline separated)"
        name="allowedDomains"
        defaultValue={platform?.allowedDomains.join("\n")}
        placeholder="app.cayrentmanager.com&#10;cayrentmanager.com"
      />
      <button type="submit" className="btn-primary">
        Save Platform
      </button>
    </form>
  );
}
