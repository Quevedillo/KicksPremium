import Stripe from 'stripe';

// Stripe server-side instance
export const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

// Public key for client-side
export const STRIPE_PUBLIC_KEY = import.meta.env.PUBLIC_STRIPE_PUBLIC_KEY || '';
