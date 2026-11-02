import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

import { GUEST_AUTH_STORAGE_KEY } from '../core/constants';

const guestClient = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL,
  headers: {
    Accept: 'application/json',
  },
});

export const supabaseGuest = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: { storageKey: GUEST_AUTH_STORAGE_KEY },
});

export default guestClient;
