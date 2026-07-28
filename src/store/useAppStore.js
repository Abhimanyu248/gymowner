import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { api } from '../utils/api';

const THEME_MODE_KEY = 'theme_mode';
const PLANS_CACHE_KEY = 'cached_plans';
const STATS_CACHE_KEY = 'cached_dashboard_stats';

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
    const startTime = Date.now();
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

        // Load cached plans and stats
        let hasCache = false;
        try {
          const [cachedPlans, cachedStats] = await Promise.all([
            AsyncStorage.getItem(PLANS_CACHE_KEY),
            AsyncStorage.getItem(STATS_CACHE_KEY),
          ]);
          if (cachedPlans) {
            set({ plans: JSON.parse(cachedPlans) });
            hasCache = true;
          }
          if (cachedStats) {
            set({ dashboardStats: JSON.parse(cachedStats) });
            hasCache = true;
          }
        } catch (cacheErr) {
          console.error('Error loading cached plans/stats:', cacheErr);
        }

        // Fetch data silently if we have cached plans or stats
        await get().fetchAppData(hasCache);

        // Run automatic backup silently in background 3 seconds after startup data is loaded
        setTimeout(() => {
          const { AutoBackupManager } = require('../utils/autoBackup');
          AutoBackupManager.runAutomaticBackup().catch((err) => {
            alert('[AutoBackup] Background weekly backup task failed.');
          });
        }, 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 2000 - elapsedTime);
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }
      set({ isHydrating: false });
    }
  },

  login: async (email, password) => {
    try {
      const user = await api.login(email, password);
      set({ isAuthenticated: true, user });
      await get().fetchAppData();

      // Run automatic backup silently in background 3 seconds after login data is loaded
      setTimeout(() => {
        const { AutoBackupManager } = require('../utils/autoBackup');
        AutoBackupManager.runAutomaticBackup().catch((err) => {
          alert('[AutoBackup] Background weekly backup task failed.');
        });
      }, 3000);

      return true;
    } catch (e) {
      throw e;
    }
  },

  logout: () => {
    api.logout();
    AsyncStorage.multiRemove([PLANS_CACHE_KEY, STATS_CACHE_KEY]).catch((e) => {
      console.error('Failed to clear cached plans/stats on logout:', e);
    });
    set({
      isAuthenticated: false,
      user: null,
      members: [],
      deletedMembers: [],
      plans: [],
      payments: [],
      dashboardStats: null,
      paymentStats: null,
    });
  },

  setThemeMode: (mode) => {
    const normalized = mode === 'dark' ? 'dark' : 'light';
    set({ themeMode: normalized });
    AsyncStorage.setItem(THEME_MODE_KEY, normalized).catch((e) => {
      console.error('Failed to persist theme mode:', e);
    });
  },

  fetchStats: async () => {
    try {
      const [statsData, payStats] = await Promise.all([
        api.getDashboardStats().catch(e => { console.error('dashboard stats error:', e); return null; }),
        api.getPaymentStats().catch(e => { console.error('payment stats error:', e); return null; }),
      ]);
      set({
        dashboardStats: statsData,
        paymentStats: payStats,
      });
    } catch (e) {
      console.error('fetchStats error:', e);
    }
  },

  fetchAppData: async (silent = false) => {
    if (!silent) {
      set({ isLoadingData: true, error: null });
    }
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

      // Persist plans cache
      AsyncStorage.setItem(PLANS_CACHE_KEY, JSON.stringify(mappedPlans)).catch(e => {
        console.error('Failed to cache plans:', e);
      });

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

      // Persist stats cache
      if (statsData) {
        AsyncStorage.setItem(STATS_CACHE_KEY, JSON.stringify(statsData)).catch(e => {
          console.error('Failed to cache stats:', e);
        });
      }
    } catch (e) {
      console.error('fetchAppData error:', e);
      set({ error: e.message, isLoadingData: false });
    }
  },

  // Member Operations
  addMember: async (payload) => {
    const member = await api.createMember(payload);
    const mapped = { ...member, id: member._id || member.id };

    set(state => ({
      members: [mapped, ...state.members]
    }));

    await get().fetchAppData(true);
    return mapped;
  },
  
  updateMember: async (id, payload, silent = false, skipFetch = false) => {
    const updated = await api.updateMember(id, payload);
    const mapped = { ...updated, id: updated._id || updated.id };
    set(state => ({
      members: state.members.map(m => (m.id === id || m._id === id ? mapped : m))
    }));
    if (!skipFetch) {
      await get().fetchAppData(true);
    }
    return mapped;
  },

  deleteMember: async (id, hard = false) => {
    await api.deleteMember(id, hard);
    set(state => {
      const deletedMember = state.members.find(m => m.id === id || m._id === id) || state.deletedMembers.find(m => m.id === id || m._id === id);
      const updatedMembers = state.members.filter(m => m.id !== id && m._id !== id);
      const updatedDeleted = hard 
        ? state.deletedMembers.filter(m => m.id !== id && m._id !== id) 
        : (deletedMember ? [{ ...deletedMember, status: 'deleted' }, ...state.deletedMembers.filter(m => m.id !== id && m._id !== id)] : state.deletedMembers);
      return {
        members: updatedMembers,
        deletedMembers: updatedDeleted,
      };
    });
    await get().fetchAppData(true);
  },

  restoreMember: async (id) => {
    const restored = await api.restoreMember(id);
    const mapped = { ...restored, id: restored._id || restored.id };
    set(state => ({
      deletedMembers: state.deletedMembers.filter(m => m.id !== id && m._id !== id),
      members: [mapped, ...state.members]
    }));
    await get().fetchAppData(true);
  },

  getMemberCredentials: async (id) => {
    return await api.getMemberCredentials(id);
  },

  // Plan Operations
  addPlan: async (payload) => {
    const plan = await api.createPlan(payload);
    const mapped = { ...plan, id: plan._id || plan.id };
    set(state => {
      const updatedPlans = [mapped, ...state.plans];
      AsyncStorage.setItem(PLANS_CACHE_KEY, JSON.stringify(updatedPlans)).catch(e => {
        console.error('Failed to cache plans after add:', e);
      });
      return { plans: updatedPlans };
    });
  },

  updatePlan: async (id, payload) => {
    const updated = await api.updatePlan(id, payload);
    const mapped = { ...updated, id: updated._id || updated.id };
    set(state => {
      const updatedPlans = state.plans.map(p => (p.id === id || p._id === id ? mapped : p));
      AsyncStorage.setItem(PLANS_CACHE_KEY, JSON.stringify(updatedPlans)).catch(e => {
        console.error('Failed to cache plans after update:', e);
      });
      return { plans: updatedPlans };
    });
    await get().fetchAppData(true);
  },

  deletePlan: async (id) => {
    await api.deletePlan(id);
    set(state => {
      const updatedPlans = state.plans.filter(p => p.id !== id && p._id !== id);
      AsyncStorage.setItem(PLANS_CACHE_KEY, JSON.stringify(updatedPlans)).catch(e => {
        console.error('Failed to cache plans after delete:', e);
      });
      return { plans: updatedPlans };
    });
    await get().fetchAppData(true);
  },

  // Payment Operations
  addPayment: async (payload, skipFetch = false) => {
    const payment = await api.createPayment(payload);
    const mapped = { ...payment, id: payment._id || payment.id };
    set(state => ({
      payments: [mapped, ...state.payments]
    }));
    if (!skipFetch) {
      await get().fetchAppData(true);
    }
    return mapped;
  },

  deletePayment: async (id) => {
    await api.deletePayment(id);
    set(state => ({
      payments: state.payments.filter(p => p.id !== id && p._id !== id)
    }));
    await get().fetchAppData(true);
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
