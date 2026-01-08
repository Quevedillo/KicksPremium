// src/lib/auth-init.ts
// This file must be imported in every page that needs auth functionality
// Add this to your Astro layout or page:
// ---
// import '@lib/auth-init';
// ---

import { initializeAuth } from '@stores/auth';

// Initialize authentication on page load
if (typeof window !== 'undefined') {
  initializeAuth();
}
