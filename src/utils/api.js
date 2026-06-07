import AsyncStorage from '@react-native-async-storage/async-storage';

// local server url
const API_BASE_URL = 'http://10.138.122.148:3000/api';
//online server url
// const API_BASE_URL = 'https://backend-txff.onrender.com/api';
const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';

class ApiService {
  constructor() {
    this.token = null;
    this.onNetworkError = null;
  }

  async init() {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      this.token = token;
    }
    return this.token;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    }
  }

  async setStoredUser(user) {
    if (!user) {
      await AsyncStorage.removeItem(AUTH_USER_KEY);
      return;
    }
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  }

  async getStoredUser() {
    const raw = await AsyncStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...(options.headers || {}),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, { ...options, headers, signal: controller.signal }).catch(err => {
      clearTimeout(timeoutId);
      // fetch completely failed (e.g. no internet, backend server down/unreachable, or timeout)
      try {
        const { useAppStore } = require('../store/useAppStore');
        useAppStore.getState().setNetworkError(true, err.name === 'AbortError' ? 'Connection Timed Out' : (err.message || 'Network request failed'));
      } catch (e) {
        console.warn('Could not set network error state', e);
      }
      throw new Error('NETWORK_ERROR');
    });
    clearTimeout(timeoutId);
    
    // Treat gateway errors as network errors
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      try {
        const { useAppStore } = require('../store/useAppStore');
        useAppStore.getState().setNetworkError(true, 'Backend Server Unreachable');
      } catch (e) {}
      throw new Error('NETWORK_ERROR');
    }
    
    // Parse JSON safely
    let data;
    const text = await response.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      data = { message: text };
    }

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Network request failed');
    }

    return data;
  }

  // Auth
  async login(email, password) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.token);
    await this.setStoredUser(res.user);
    return res.user;
  }

  async register(name, email, password) {
    const res = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role: 'admin' }),
    });
    this.setToken(res.token);
    await this.setStoredUser(res.user);
    return res.user;
  }

  async forgotPassword(email) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(email, otp, newPassword) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword }),
    });
  }

  async updateProfile(profileData) {
    return this.request('/auth/update-profile', {
      method: 'POST',
      body: JSON.stringify(profileData),
    });
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  logout() {
    this.setToken(null);
    AsyncStorage.removeItem(AUTH_USER_KEY);
  }

  // Health
  async checkHealth() {
    // Just a quick ping to see if server responds
    // Ideally your backend has a /health or similar. We can ping any public endpoint or root API.
    // If it throws, request() handles it. If not, it means we reached the server.
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${API_BASE_URL}/`, { method: 'GET', signal: controller.signal });
      clearTimeout(timeoutId);
      return res.ok || res.status < 500;
    } catch (err) {
      return false;
    }
  }

  // Plans
  async getPlans() {
    return this.request('/plans');
  }

  async createPlan(plan) {
    return this.request('/plans', {
      method: 'POST',
      body: JSON.stringify(plan),
    });
  }

  async updatePlan(id, plan) {
    return this.request(`/plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(plan),
    });
  }

  async deletePlan(id) {
    return this.request(`/plans/${id}`, {
      method: 'DELETE',
    });
  }

  // Members
  async getMembers(query = {}) {
    const params = new URLSearchParams({ limit: 1000, ...query }).toString();
    const res = await this.request(`/members?${params}`);
    return res.data;
  }

  async createMember(member) {
    return this.request('/members', {
      method: 'POST',
      body: JSON.stringify(member),
    });
  }

  async updateMember(id, member) {
    return this.request(`/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(member),
    });
  }

  async deleteMember(id, hard = false) {
    const endpoint = `/members/${id}` + (hard ? '?hard=true' : '');
    return this.request(endpoint, {
      method: 'DELETE',
    });
  }

  async restoreMember(id) {
    return this.request(`/members/${id}/restore`, {
      method: 'PUT',
    });
  }

  async getMemberCredentials(id) {
    return this.request(`/members/${id}/credentials`);
  }

  // Dashboard
  async getDashboardStats() {
    return this.request('/dashboard/stats');
  }

  // Payments
  async getPayments(query = {}) {
    const params = new URLSearchParams({ limit: 100, ...query }).toString();
    const res = await this.request(`/payments?${params}`);
    return res.data || res; // handle paginated or plain array
  }

  async getPaymentStats() {
    return this.request('/payments/stats');
  }

  async createPayment(payment) {
    return this.request('/payments', {
      method: 'POST',
      body: JSON.stringify(payment),
    });
  }

  async deletePayment(id) {
    return this.request(`/payments/${id}`, {
      method: 'DELETE',
    });
  }

  // Notifications
  async sendBroadcastNotification(payload) {
    return this.request('/notifications/send-offer', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async triggerRenewalReminders(days = 7) {
    return this.request(`/notifications/send-renewal?days=${days}`, {
      method: 'POST',
    });
  }

  async sendMemberReminder(memberId) {
    return this.request(`/notifications/send-member-reminder/${memberId}`, {
      method: 'POST',
    });
  }
  
  async restoreBackup(data) {
    return this.request('/backup/restore', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Reports / PDF or Excel download
  async downloadReport({ includeMembers = true, includeTransactions = true, format = 'pdf' } = {}) {
    const params = new URLSearchParams({
      includeMembers: String(includeMembers),
      includeTransactions: String(includeTransactions),
      format,
    }).toString();

    const url = `${API_BASE_URL}/reports/download?${params}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Failed to download report');
    }

    // Return as base64 for expo-file-system
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  async downloadInvoice(paymentId) {
    const url = `${API_BASE_URL.replace('/api', '')}/invoice/${paymentId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Failed to download invoice');
    }

    // Return as base64 for expo-file-system
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  getInvoiceUrl(paymentId) {
    return `${API_BASE_URL.replace('/api', '')}/invoice/${paymentId}`;
  }

  async uploadImage(uri) {
    const url = `${API_BASE_URL}/upload/image`;
    const formData = new FormData();
    const fileExt = uri.split('.').pop()?.split('?')[0] || 'jpg';
    const fileName = `gym_${Date.now()}.${fileExt}`;
    const mimeType = `image/${fileExt === 'png' ? 'png' : 'jpeg'}`;

    formData.append('file', {
      uri,
      name: fileName,
      type: mimeType,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      let msg = 'Upload failed';
      try {
        const parsed = JSON.parse(text);
        msg = parsed.message || parsed.error || msg;
      } catch (e) {}
      throw new Error(msg);
    }

    return response.json();
  }
}

export const api = new ApiService();
