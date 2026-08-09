-- Commercial Billing & Subscription Engine

CREATE TYPE "SubscriptionStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'HALTED');
CREATE TYPE "PlanTier" AS ENUM ('PATIENT_ESSENTIAL', 'PATIENT_SHIELD', 'CLINICAL_PRO', 'ENTERPRISE_OPS');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PAID', 'FAILED', 'VOID');

CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "plan_tier" "PlanTier" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
    "razorpay_sub_id" TEXT,
    "razorpay_plan_id" TEXT,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "tax_amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "hsn_sac_code" TEXT NOT NULL DEFAULT '998313',
    "invoice_number" TEXT NOT NULL,
    "gstin" TEXT,
    "pdf_url" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscriptions_razorpay_sub_id_key" ON "subscriptions"("razorpay_sub_id");
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");
CREATE INDEX "subscriptions_tenant_id_idx" ON "subscriptions"("tenant_id");
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");
CREATE INDEX "invoices_subscription_id_idx" ON "invoices"("subscription_id");
CREATE INDEX "invoices_created_at_idx" ON "invoices"("created_at");

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
