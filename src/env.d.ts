/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  // Supabase
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;

  // Stripe
  readonly STRIPE_SECRET_KEY: string;
  readonly PUBLIC_STRIPE_PUBLIC_KEY: string;
  readonly STRIPE_WEBHOOK_SECRET: string;

  // Cloudinary
  readonly PUBLIC_CLOUDINARY_CLOUD_NAME: string;
  readonly CLOUDINARY_API_KEY: string;
  readonly CLOUDINARY_API_SECRET: string;

  // Email
  readonly SMTP_HOST?: string;
  readonly SMTP_PORT?: string;
  readonly SMTP_USER?: string;
  readonly SMTP_PASS?: string;
  readonly RESEND_API_KEY?: string;

  // App
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_ADMIN_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    user?: {
      id: string;
      email: string;
      role: string;
    };
  }
}
