"use client";

import { AdBanner, SponsoredCard, NativeAd } from "@/plugin";

export function CayRentManagerDemo({
  engineUrl,
  apiKey,
}: {
  engineUrl: string;
  apiKey: string;
}) {
  const common = { engineUrl, apiKey, platform: "cayrentmanager" };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Landlord Dashboard
          </h2>
          <AdBanner
            {...common}
            placement="landlord_dashboard_top"
            userRole="LANDLORD"
            category="insurance"
          />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Maintenance Request
          </h2>
          <SponsoredCard
            {...common}
            placement="maintenance_request_vendor_card"
            userRole="LANDLORD"
            category="property maintenance"
          />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Billing Page
          </h2>
          <NativeAd
            {...common}
            placement="billing_page_partner_offer"
            userRole="LANDLORD"
            category="banking"
          />
        </section>
      </div>

      <aside className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Tenant Portal Sidebar
          </h2>
          <SponsoredCard
            {...common}
            placement="tenant_portal_sidebar"
            userRole="TENANT"
          />
        </div>
      </aside>
    </div>
  );
}
