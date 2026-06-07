import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { api } from '../utils/api';

const THEME_MODE_KEY = 'theme_mode';

export const useAppStore = create((set, get) => ({
  // Auth State
  isAuthenticated: false,
  isHydrating: true,
  user: null,
  themeMode: Appearance.getColorScheme() || 'light',

  // App Data
  members: [],
  deletedMembers: [],
  plans: [],
  payments: [],
  dashboardStats: null,
  paymentStats: null,
  
  // Loading States
  isLoadingData: false,
  error: null,
  isNetworkError: false,
  networkErrorMessage: '',

  // Actions
  setNetworkError: (isError, message = '') => set({ isNetworkError: isError, networkErrorMessage: message }),

  retryConnection: async () => {
    // Quick ping to check if we can reach backend
    const isHealthy = await api.checkHealth();
    if (isHealthy) {
      set({ isNetworkError: false, networkErrorMessage: '' });
      await get().fetchAppData();
      return true;
    }
    return false;
  },

  init: async () => {
    try {
      // Setup network listener
      NetInfo.addEventListener(state => {
        if (state.isConnected === false) {
          get().setNetworkError(true, 'No Internet Connection');
        } else if (state.isConnected && get().isNetworkError) {
          // Attempt recovery when connection returns
          get().retryConnection();
        }
      });

      const storedThemeMode = await AsyncStorage.getItem(THEME_MODE_KEY);
      if (storedThemeMode === 'dark' || storedThemeMode === 'light') {
        set({ themeMode: storedThemeMode });
      }

      const token = await api.init();
      if (token) {
        const storedUser = await api.getStoredUser();
        set({ isAuthenticated: true, user: storedUser || null });
        await get().fetchAppData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      set({ isHydrating: false });
    }
  },

  login: async (email, password) => {
    try {
      const user = await api.login(email, password);
      set({ isAuthenticated: true, user });
      await get().fetchAppData();
      return true;
    } catch (e) {
      throw e;
    }
  },

  logout: () => {
    api.logout();
    set({ isAuthenticated: false, user: null, members: [], plans: [], payments: [] });
  },

  setThemeMode: (mode) => {
    const normalized = mode === 'dark' ? 'dark' : 'light';
    set({ themeMode: normalized });
    AsyncStorage.setItem(THEME_MODE_KEY, normalized).catch((e) => {
      console.error('Failed to persist theme mode:', e);
    });
  },

  fetchAppData: async () => {
    set({ isLoadingData: true, error: null });
    try {
      // Fetch core data independently so one failure doesn't break everything
      const [membersData, deletedMembersData, plansData] = await Promise.all([
        api.getMembers().catch(e => { console.error('members fetch error:', e); return []; }),
        api.getMembers({ status: 'deleted' }).catch(e => { console.error('deleted members fetch error:', e); return []; }),
        api.getPlans().catch(e => { console.error('plans fetch error:', e); return []; }),
      ]);

      const mappedMembers = (membersData || []).map(m => ({ ...m, id: m._id || m.id }));
      const mappedDeleted = (deletedMembersData || []).map(m => ({ ...m, id: m._id || m.id }));
      const mappedPlans = (plansData || []).map(p => ({ ...p, id: p._id || p.id }));

      set({ members: mappedMembers, deletedMembers: mappedDeleted, plans: mappedPlans });

      // Fetch supplementary data without blocking
      const [statsData, payStats, paymentsData] = await Promise.all([
        api.getDashboardStats().catch(e => { console.error('dashboard stats error:', e); return null; }),
        api.getPaymentStats().catch(e => { console.error('payment stats error:', e); return null; }),
        api.getPayments().catch(e => { console.error('payments fetch error:', e); return []; }),
      ]);

      const mappedPayments = (paymentsData || []).map(p => ({ ...p, id: p._id || p.id }));

      set({
        dashboardStats: statsData,
        paymentStats: payStats,
        payments: mappedPayments,
        isLoadingData: false,
      });
    } catch (e) {
      console.error('fetchAppData error:', e);
      set({ error: e.message, isLoadingData: false });
    }
  },

  // Member Operations
  addMember: async (payload) => {
    const member = await api.createMember(payload);
    await get().fetchAppData();
    return member;
  },
  
  updateMember: async (id, payload) => {
    await api.updateMember(id, payload);
    await get().fetchAppData();
  },

  deleteMember: async (id, hard = false) => {
    await api.deleteMember(id, hard);
    await get().fetchAppData();
  },

  restoreMember: async (id) => {
    await api.restoreMember(id);
    await get().fetchAppData();
  },

  getMemberCredentials: async (id) => {
    return await api.getMemberCredentials(id);
  },

  // Plan Operations
  addPlan: async (payload) => {
    await api.createPlan(payload);
    await get().fetchAppData();
  },

  updatePlan: async (id, payload) => {
    await api.updatePlan(id, payload);
    await get().fetchAppData();
  },

  deletePlan: async (id) => {
    await api.deletePlan(id);
    await get().fetchAppData();
  },

  // Payment Operations
  addPayment: async (payload) => {
    await api.createPayment(payload);
    await get().fetchAppData();
  },

  deletePayment: async (id) => {
    await api.deletePayment(id);
    await get().fetchAppData();
  },

  // Notification Operations
  sendBroadcast: async (payload) => {
    return await api.sendBroadcastNotification(payload);
  },

  triggerRenewals: async (days) => {
    return await api.triggerRenewalReminders(days);
  },

  sendMemberReminder: async (memberId) => {
    return await api.sendMemberReminder(memberId);
  },
}));
