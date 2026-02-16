import Stripe from 'stripe';

const stripeSecretKey = import.meta.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable. Check your .env file.');
}

/** Instancia Stripe server-side. Solo usar en API routes y server-side code. */
export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-12-18.acacia',
});

/** Clave pública de Stripe para componentes client-side. */
export const STRIPE_PUBLIC_KEY = import.meta.env.PUBLIC_STRIPE_PUBLIC_KEY || '';
