import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

export const advertiserSchema = z.object({
  businessName: z.string().trim().min(1, "Business name is required"),
  contactName: z.string().trim().min(1, "Contact name is required"),
  email: z.string().trim().email("Valid email required"),
  phone: optionalString,
  website: optionalString,
  industry: optionalString,
  billingStatus: z.enum(["CURRENT", "PAST_DUE", "ON_HOLD"]),
  status: z.enum(["ACTIVE", "INACTIVE", "PROSPECT"]),
  notes: optionalString,
});

export const platformSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  slug: z
    .string()
    .trim()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  allowedDomains: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(/[\n,]/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
});

export const placementSchema = z.object({
  platformId: z.string().min(1),
  placementKey: z
    .string()
    .trim()
    .min(2)
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers and underscores only"),
  name: z.string().trim().min(1),
  description: optionalString,
  placementType: z.enum(["BANNER", "SIDEBAR", "CARD", "NATIVE", "VIDEO"]),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  allowedSizes: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
});

export const campaignSchema = z
  .object({
    advertiserId: z.string().min(1, "Advertiser is required"),
    name: z.string().trim().min(1, "Name is required"),
    objective: z.enum(["AWARENESS", "TRAFFIC", "LEADS", "CONVERSIONS"]),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    budget: z.coerce.number().min(0),
    pricingModel: z.enum(["CPM", "CPC", "FLAT", "HOUSE"]),
    status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ENDED"]),
    priority: z.coerce.number().int().min(1).max(10),
    dailyImpressionLimit: z.coerce.number().int().min(0).optional(),
    totalImpressionLimit: z.coerce.number().int().min(0).optional(),
    frequencyCapPerUserPerDay: z.coerce.number().int().min(0).optional(),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export const creativeSchema = z.object({
  campaignId: z.string().min(1),
  title: z.string().trim().min(1, "Title is required"),
  description: optionalString,
  imageUrl: optionalString,
  videoUrl: optionalString,
  destinationUrl: z.string().trim().url("Valid destination URL required"),
  ctaText: optionalString,
  creativeType: z.enum(["IMAGE", "VIDEO", "NATIVE", "HTML"]),
  width: z.coerce.number().int().min(0).optional(),
  height: z.coerce.number().int().min(0).optional(),
  approvalStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export type FormResult = { ok: boolean; error?: string };
