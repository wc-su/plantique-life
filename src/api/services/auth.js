import adminClient from '../clients/adminClient';
import { supabaseGuest } from '../clients/guestClient';

export const authApi = {
  login: data => adminClient.post('/admin/signin', data),
  check: () => adminClient.post('/api/user/check'),
  logout: () => adminClient.post('/logout'),
};

export const guestAuthApi = {
  register: async ({ email, password, name, receiveNews }) => {
    const { data, error } = await supabaseGuest.auth.signUp({
      email,
      password,
      options: { data: { name, receive_news: receiveNews } },
    });
    if (error) throw error;
    return data; // { user, session }
  },
  login: async ({ email, password }) => {
    const { data, error } = await supabaseGuest.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data; // { user, session }
  },
  check: async () => {
    const { data, error } = await supabaseGuest.auth.getSession();
    if (error) throw error;
    return data; // { session }
  },
  logout: async () => {
    const { error } = await supabaseGuest.auth.signOut();
    if (error) throw error;
  },
};
