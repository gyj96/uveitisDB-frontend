import { defineStore } from 'pinia';
import axios from 'axios';

const backendBase = (window as any).GYJ_DESKTOP?.backendBase || 'http://127.0.0.1:8080';

export const api = axios.create({
  baseURL: backendBase + '/api',
  timeout: 30000,
});

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('gyj_token') || '',
    username: localStorage.getItem('gyj_user') || '',
  }),
  getters: {
    isAuthed: (state) => Boolean(state.token),
  },
  actions: {
    async login(username: string, password: string) {
      const res = await api.post('/login', { username, password });
      const token = res.data.token;
      this.token = token;
      this.username = username;
      localStorage.setItem('gyj_token', token);
      localStorage.setItem('gyj_user', username);
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
    },
    load() {
      if (this.token) {
        api.defaults.headers.common.Authorization = `Bearer ${this.token}`;
      }
    },
    logout() {
      this.token = '';
      this.username = '';
      localStorage.removeItem('gyj_token');
      localStorage.removeItem('gyj_user');
      delete api.defaults.headers.common.Authorization;
    },
  },
});
