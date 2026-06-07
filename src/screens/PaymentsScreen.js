import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, TextInput, Modal, FlatList, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Filter, Calendar, ChevronDown, ChevronUp, User, Trash2, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useAppStore } from '../store/useAppStore';
import MetricCard from '../components/MetricCard';
import CustomAlert from '../components/CustomAlert';
import { radius, spacing, typography } from '../theme/theme';
import { useThemeColors } from '../theme/palette';

// ─── Pagination helper ──────────────────────────────────────────────────────
function getPageNumbers(currentPage, totalPages) {
  const pages = [];
  const maxVisiblePages = 5;
  
  if (totalPages <= maxVisiblePages) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);
    
    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);
    
    if (currentPage <= 2) {
      end = 4;
    } else if (currentPage >= totalPages - 1) {
      start = totalPages - 3;
    }
    
    if (start > 2) {
      pages.push('...');
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    if (end < totalPages - 1) {
      pages.push('...');
    }
    
    pages.push(totalPages);
  }
  
  return pages;
}

const PAYMENT_METHODS = ['cash', 'upi', 'card', 'bank_transfer', 'other'];

export default function PaymentsScreen() {
  const { paymentStats, payments, members, plans, isLoadingData, fetchAppData, deletePayment } = useAppStore();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const navigation = useNavigation();

  const [dateFilter, setDateFilter] = useState('all');
  const [customDate, setCustomDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDateFilterModal, setShowDateFilterModal] = useState(false);
  const [expandedPaymentId, setExpandedPaymentId] = useState(null);

  const [showCustomRevenueModal, setShowCustomRevenueModal] = useState(false);
  const [customRevenueStart, setCustomRevenueStart] = useState(new Date());
  const [customRevenueEnd, setCustomRevenueEnd] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const customRangeTitle = useMemo(() => {
    const s = new Date(customRevenueStart);
    const e = new Date(customRevenueEnd);
    s.setHours(0,0,0,0);
    e.setHours(0,0,0,0);
    
    if (s.getTime() === e.getTime()) {
      return `Custom: ${s.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;
    }
    
    if (s.getDate() === 1 && e.getDate() === new Date(e.getFullYear(), e.getMonth() + 1, 0).getDate() && s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
      return `${s.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`;
    }
    
    return `${s.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - ${e.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;
  }, [customRevenueStart, customRevenueEnd]);

  const [methodFilter, setMethodFilter] = useState('all');
  const [planRevenueFilter, setPlanRevenueFilter] = useState('month');

  // Pagination states
  const [isPaginated, setIsPaginated] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // Automatically reset to page 1 when any date, custom date, or payment method filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, methodFilter, customDate]);

  const [alertConfig, setAlertConfig] = useState({ visible: false });

  const showAlert = (title, message, buttons = [{ text: 'OK' }], type = 'info') => {
    setAlertConfig({ visible: true, title, message, buttons, type });
  };

  const hideAlert = () => setAlertConfig((prev) => ({ ...prev, visible: false }));

  const handleDeletePayment = (paymentId) => {
    showAlert(
      'Delete Payment',
      'Are you sure you want to delete this payment record? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePayment(paymentId);
              setExpandedPaymentId(null);
              setTimeout(() => showAlert('Deleted', 'Payment record deleted successfully.', [{ text: 'OK' }], 'success'), 320);
            } catch (err) {
              showAlert('Error', err.message || 'Failed to delete payment.', [{ text: 'OK' }], 'error');
            }
          },
        },
      ],
      'delete'
    );
  };


  const methodFilteredPayments = useMemo(() => {
    if (methodFilter === 'all') return payments || [];
    return (payments || []).filter((p) => p?.paymentMethod === methodFilter);
  }, [payments, methodFilter]);

  const filteredPayments = useMemo(() => {
    let result = methodFilteredPayments;
    
    if (dateFilter !== 'all') {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now);
      const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon ... 6=Sat
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Mon=0 offset
      startOfWeek.setDate(now.getDate() - daysFromMonday);
      startOfWeek.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      result = result.filter(p => {
        const rawDate = p?.paidOn || p?.createdAt;
        const paidOn = rawDate ? new Date(rawDate) : null;
        if (!paidOn || Number.isNaN(paidOn.getTime())) return false;

        if (dateFilter === 'today') return paidOn >= startOfDay;
        if (dateFilter === 'week') return paidOn >= startOfWeek;
        if (dateFilter === 'month') return paidOn >= startOfMonth;
        if (dateFilter === 'year') return paidOn >= startOfYear;
        if (dateFilter === 'custom') {
          const customStart = new Date(customDate.getFullYear(), customDate.getMonth(), customDate.getDate());
          const customEnd = new Date(customStart);
          customEnd.setDate(customEnd.getDate() + 1);
          return paidOn >= customStart && paidOn < customEnd;
        }
        return true;
      });
    }

    return result;
  }, [methodFilteredPayments, dateFilter, customDate]);

  const totalPages = isPaginated ? Math.ceil(filteredPayments.length / 10) : 1;
  const activePage = Math.min(Math.max(currentPage, 1), totalPages || 1);

  // Memoized paginated payments slice
  const paginatedPayments = useMemo(() => {
    if (!isPaginated) return filteredPayments;
    const startIndex = (activePage - 1) * 10;
    return filteredPayments.slice(startIndex, startIndex + 10);
  }, [filteredPayments, isPaginated, activePage]);

  const summary = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(now.getDate() - daysFromMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const cStart = new Date(customRevenueStart.getFullYear(), customRevenueStart.getMonth(), customRevenueStart.getDate());
    const cEnd = new Date(customRevenueEnd.getFullYear(), customRevenueEnd.getMonth(), customRevenueEnd.getDate(), 23, 59, 59, 999);

    let today = 0;
    let week = 0;
    let month = 0;
    let year = 0;
    let customRange = 0;

    methodFilteredPayments.forEach((p) => {
      const amount = Number(p?.amount) || 0;
      // Fall back to createdAt when paidOn is absent (auto-generated payments)
      const rawDate = p?.paidOn || p?.createdAt;
      const paidOn = rawDate ? new Date(rawDate) : null;
      if (!paidOn || Number.isNaN(paidOn.getTime())) return;

      if (paidOn >= startOfYear) year += amount;
      if (paidOn >= startOfMonth) month += amount;
      if (paidOn >= startOfWeek) week += amount;
      if (paidOn >= startOfDay) today += amount;
      if (paidOn >= cStart && paidOn <= cEnd) customRange += amount;
    });

    return { today, week, month, year, customRange };
  }, [methodFilteredPayments, customRevenueStart, customRevenueEnd]);

  const localRevenueByPlan = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(now.getDate() - daysFromMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const result = {};

    methodFilteredPayments.forEach((p) => {
      const amount = Number(p?.amount) || 0;
      const rawDate = p?.paidOn || p?.createdAt;
      const paidOn = rawDate ? new Date(rawDate) : null;
      if (!paidOn || Number.isNaN(paidOn.getTime())) return;

      if (planRevenueFilter === 'today' && paidOn < startOfDay) return;
      if (planRevenueFilter === 'week' && paidOn < startOfWeek) return;
      if (planRevenueFilter === 'month' && paidOn < startOfMonth) return;

      let planName = 'Unknown Plan';
      
      let memberId = p?.memberId;
      if (typeof memberId === 'object' && memberId !== null) {
          memberId = memberId.id || memberId._id;
      }
      const memberObj = members.find(m => (m.id || m._id) === memberId);
      
      if (memberObj) {
        let pId = memberObj.planId;
        if (typeof pId === 'object' && pId !== null) {
           if (pId.name) {
               planName = pId.name;
           } else {
               pId = pId.id || pId._id;
               const planObj = plans.find(pl => (pl.id || pl._id) === pId);
               if (planObj) planName = planObj.name;
           }
        } else {
           const planObj = plans.find(pl => (pl.id || pl._id) === pId);
           if (planObj) planName = planObj.name;
        }
      }

      result[planName] = (result[planName] || 0) + amount;
    });

    return Object.entries(result)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [methodFilteredPayments, planRevenueFilter, members, plans]);

  const onRefresh = () => fetchAppData();


  const revenueByPlan = paymentStats?.revenueByPlan || [];

  const formatAmount = (amt) => {
    if (amt === undefined || amt === null) return 'Rs 0';
    return `Rs ${Number(amt).toLocaleString()}`;
  };

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const renderPaginationFooter = () => {
    const startItem = (activePage - 1) * 10 + 1;
    const endItem = Math.min(activePage * 10, filteredPayments.length);

    return (
      <View style={styles.paginationContainer}>
        {/* Mode selector and info row */}
        <View style={styles.paginationInfoRow}>
          <Text style={styles.paginationInfoText}>
            {isPaginated 
              ? `Showing ${startItem}-${endItem} of ${filteredPayments.length}`
              : `Showing all ${filteredPayments.length}`
            }
          </Text>
          
          {/* Segmented Mode Selector */}
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[styles.modeTab, isPaginated && styles.modeTabActive]}
              onPress={() => setIsPaginated(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.modeTabText, isPaginated && styles.modeTabTextActive]}>10 / Page</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, !isPaginated && styles.modeTabActive]}
              onPress={() => setIsPaginated(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.modeTabText, !isPaginated && styles.modeTabTextActive]}>Show All</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pagination buttons */}
        {isPaginated && totalPages > 1 && (
          <View style={styles.pageButtonsRow}>
            {/* Prev Button */}
            <TouchableOpacity
              style={[styles.pageNavBtn, activePage === 1 && styles.pageNavBtnDisabled]}
              onPress={() => activePage > 1 && setCurrentPage(activePage - 1)}
              disabled={activePage === 1}
              activeOpacity={0.7}
            >
              <ChevronLeft size={16} color={activePage === 1 ? colors.textMuted : colors.primary} />
            </TouchableOpacity>

            {/* Page numbers */}
            {getPageNumbers(activePage, totalPages).map((p, idx) => {
              if (p === '...') {
                return (
                  <View key={`ellipsis-${idx}`} style={styles.pageEllipsis}>
                    <Text style={styles.pageEllipsisText}>...</Text>
                  </View>
                );
              }
              const isSelected = p === activePage;
              return (
                <TouchableOpacity
                  key={`page-${p}`}
                  style={[styles.pageBtn, isSelected && styles.pageBtnActive]}
                  onPress={() => setCurrentPage(p)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pageBtnText, isSelected && styles.pageBtnTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Next Button */}
            <TouchableOpacity
              style={[styles.pageNavBtn, activePage === totalPages && styles.pageNavBtnDisabled]}
              onPress={() => activePage < totalPages && setCurrentPage(activePage + 1)}
              disabled={activePage === totalPages}
              activeOpacity={0.7}
            >
              <ChevronRight size={16} color={activePage === totalPages ? colors.textMuted : colors.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>Payments</Text>
        </View> */}

        <Text style={styles.sectionTitle}>Revenue Summary</Text>
        <View style={styles.filterRow}>
          {[
            { value: 'all', label: 'All' },
            { value: 'cash', label: 'Cash' },
            { value: 'upi', label: 'UPI' },
          ].map((opt, idx) => ( 
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.filterChip,
                idx !== 2 && styles.filterChipSpacing,
                methodFilter === opt.value && styles.filterChipActive,
              ]}
              onPress={() => setMethodFilter(opt.value)}
            >
              <Text style={[styles.filterChipText, methodFilter === opt.value && styles.filterChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.metricsRow}>
          <MetricCard title="Today" value={formatAmount(summary.today)} color={colors.secondary} />
          <MetricCard title="This Week" value={formatAmount(summary.week)} color={colors.primary } />
        </View>
        <View style={styles.metricsRow}>
          <MetricCard title="This Month" value={formatAmount(summary.month)} color={colors.primary} />
          <MetricCard title="This Year" value={formatAmount(summary.year)} color={colors.warning} />
        </View>
        <View style={styles.metricsRow}>
          <TouchableOpacity style={{ flex: 1, flexDirection: 'row' }} activeOpacity={0.8} onPress={() => setShowCustomRevenueModal(true)}>
            <MetricCard 
              title={customRangeTitle} 
              value={formatAmount(summary.customRange)} 
              color={colors.success} 
              icon={<Calendar size={18} color={colors.success} />}
            />
          </TouchableOpacity>
        </View>

        {/* ── Revenue by Plan ─────────────────────────────────────────── */}
        <View style={[styles.headerRow, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Revenue by Plan</Text>
        </View>
        <View style={styles.filterRow}>
          {[
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'This Week' },
            { value: 'month', label: 'This Month' },
          ].map((opt, idx) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.filterChip,
                idx !== 2 && styles.filterChipSpacing,
                planRevenueFilter === opt.value && styles.filterChipActive,
              ]}
              onPress={() => setPlanRevenueFilter(opt.value)}
            >
              <Text style={[styles.filterChipText, planRevenueFilter === opt.value && styles.filterChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.card}>
          {localRevenueByPlan.length === 0 ? (
            <Text style={styles.emptyText}>
              No transactions recorded for{' '}
              {planRevenueFilter === 'today' ? 'today' : planRevenueFilter === 'week' ? 'this week' : 'this month'}.
            </Text>
          ) : (
            localRevenueByPlan.map((item, index) => (
              <View key={index} style={styles.listItem}>
                <Text style={styles.listLabel}>{item.name}</Text>
                <Text style={styles.listValue}>{formatAmount(item.amount)}</Text>
              </View>
            ))
          )}
        </View>


        <View style={[styles.headerRow, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Recent Payments</Text>
          <TouchableOpacity style={styles.filterBtn} onPress={() => setShowDateFilterModal(true)}>
            <Filter size={14} color={colors.accent} style={{ marginRight: 6 }} />
            <Text style={styles.filterBtnText}>
              {dateFilter === 'all' ? 'All Time' : 
               dateFilter === 'custom' ? formatDate(customDate) : 
               dateFilter === 'week' ? 'This Week' : 
               dateFilter === 'month' ? 'This Month' : 
               dateFilter === 'year' ? 'This Year' : 'Today'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          {filteredPayments.length === 0 ? (
            <Text style={styles.emptyText}>No payments found.</Text>
          ) : (
            <>
              {paginatedPayments.map((p, idx) => {
                const isExpanded = expandedPaymentId === (p.id || p._id);
                const memberObj = p.memberId || {};
                const memberId = memberObj._id || memberObj.id;
                
                return (
                  <TouchableOpacity 
                    key={p.id || p._id || idx} 
                    style={[styles.listItem, idx === paginatedPayments.length - 1 && !isExpanded && { borderBottomWidth: 0 }, isExpanded && styles.expandedItem]}
                    onPress={() => setExpandedPaymentId(isExpanded ? null : (p.id || p._id))}
                    activeOpacity={0.7}
                  >
                    <View style={{ width: '100%' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.payeeName}>{memberObj.name || 'Deleted Member'}</Text>
                          <Text style={styles.payMeta}>{p.paymentMethod?.toUpperCase()} - {formatDate(p.paidOn || p.createdAt)}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', flexDirection: 'row' }}>
                          <Text style={styles.payAmount}>{formatAmount(p.amount)}</Text>
                          {isExpanded ? <ChevronUp size={20} color={colors.textMuted} style={{ marginLeft: 8 }} /> : <ChevronDown size={20} color={colors.textMuted} style={{ marginLeft: 8 }} />}
                        </View>
                      </View>
                      
                      {p.notes && !isExpanded ? <Text style={styles.payNotes} numberOfLines={1}>{p.notes}</Text> : null}
                      
                      {isExpanded && (
                        <View style={styles.expandedContent}>
                          {p.notes ? (
                            <View style={styles.expandedRow}>
                              <Text style={styles.expandedLabel}>Notes:</Text>
                              <Text style={styles.expandedValue}>{p.notes}</Text>
                            </View>
                          ) : null}
                          
                          <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>
                            {memberId && (
                              <TouchableOpacity 
                                style={[styles.viewProfileBtn, { marginTop: 0 }]}
                                onPress={() => navigation.navigate('MemberDetail', { memberId })}
                              >
                                <User size={16} color={colors.primary} />
                                <Text style={styles.viewProfileText}>View Profile</Text>
                              </TouchableOpacity>
                            )}

                            <TouchableOpacity
                              style={[styles.deletePaymentBtn, { marginTop: 0 }]}
                              onPress={() => handleDeletePayment(p.id || p._id)}
                            >
                              <Trash2 size={16} color={colors.danger} />
                              <Text style={styles.deletePaymentText}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
              
              {renderPaginationFooter()}
            </>
          )}
        </View>
      </ScrollView>


      <Modal visible={showDateFilterModal} transparent animationType="fade" onRequestClose={() => setShowDateFilterModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowDateFilterModal(false)}>
          <View style={styles.filterMenuContainer}>
            <Text style={styles.filterMenuTitle}>Filter by Date</Text>
            
            {[
              { value: 'all', label: 'All Time' },
              { value: 'today', label: 'Today' },
              { value: 'week', label: 'This Week' },
              { value: 'month', label: 'This Month' },
              { value: 'year', label: 'This Year' },
              { value: 'custom', label: 'Custom Date...' },
            ].map(opt => (
              <TouchableOpacity 
                key={opt.value} 
                style={[styles.filterOption, dateFilter === opt.value && styles.filterOptionActive]}
                onPress={() => {
                  if (opt.value === 'custom') {
                    setShowDatePicker(true);
                  } else {
                    setDateFilter(opt.value);
                    setShowDateFilterModal(false);
                  }
                }}
              >
                <Text style={[styles.filterOptionText, dateFilter === opt.value && styles.filterOptionTextActive]}>
                  {opt.label}
                </Text>
                {dateFilter === opt.value && opt.value === 'custom' && (
                   <Text style={styles.customDateText}>{formatDate(customDate)}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {showDatePicker && (
        <DateTimePicker
          value={customDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              setCustomDate(selectedDate);
              setDateFilter('custom');
              setShowDateFilterModal(false);
            }
          }}
        />
      )}

      <Modal visible={showCustomRevenueModal} transparent animationType="fade" onRequestClose={() => setShowCustomRevenueModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCustomRevenueModal(false)}>
          <View style={[styles.filterMenuContainer, { backgroundColor: colors.surface }]}>
            <Text style={styles.filterMenuTitle}>Select Revenue Period</Text>
            
            <Text style={styles.label}>Start Date</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowStartPicker(true)}>
              <Text style={{ color: colors.textPrimary, marginTop: 12 }}>{formatDate(customRevenueStart)}</Text>
            </TouchableOpacity>

            <Text style={styles.label}>End Date</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowEndPicker(true)}>
              <Text style={{ color: colors.textPrimary, marginTop: 12 }}>{formatDate(customRevenueEnd)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.saveBtn, { marginTop: spacing.md }]} onPress={() => setShowCustomRevenueModal(false)}>
              <Text style={styles.saveBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {showStartPicker && (
        <DateTimePicker
          value={customRevenueStart}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowStartPicker(false);
            if (selectedDate) setCustomRevenueStart(selectedDate);
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={customRevenueEnd}
          mode="date"
          display="default"
          minimumDate={customRevenueStart}
          onChange={(event, selectedDate) => {
            setShowEndPicker(false);
            if (selectedDate) setCustomRevenueEnd(selectedDate);
          }}
        />
      )}

      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        type={alertConfig.type}
        onClose={hideAlert}
      />
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  pageTitle: {
    ...typography.heading,
    fontSize: 22,
    color: colors.textPrimary,
  },
  recordBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  recordBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  sectionTitle: {
    ...typography.heading,
    fontSize: typography.sizes?.md || 16,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipSpacing: {
    marginRight: spacing.sm,
  },
  filterChipActive: {
    borderColor: colors.accent,
    backgroundColor: `${colors.accent}20`,
  },
  filterChipText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: colors.accent,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listLabel: {
    ...typography.body,
    fontSize: 15,
    color: colors.textPrimary,
  },
  listValue: {
    ...typography.heading,
    fontSize: 15,
    color: colors.secondary,
  },
  payeeName: {
    fontWeight: '600',
    color: colors.textPrimary,
    fontSize: 14,
  },
  payMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  payNotes: {
    color: colors.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  payAmount: {
    fontWeight: '700',
    fontSize: 15,
    color: colors.accent,
    marginLeft: spacing.sm,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    padding: spacing.md,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.heading,
    fontSize: 18,
    color: colors.textPrimary,
  },
  cancelText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 44,
    marginBottom: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  pickerBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 44,
    justifyContent: 'center',
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  pickerBtnText: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  pickerBtnPlaceholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
  methodChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 8,
    marginBottom: 8,
  },
  methodChipActive: {
    borderColor: colors.accent,
    backgroundColor: `${colors.accent}20`,
  },
  methodChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  methodChipTextActive: {
    color: colors.accent,
  },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 44,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  memberRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  memberRowName: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
  memberRowPhone: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  errorText: {
    color: colors.danger,
    marginBottom: spacing.sm,
    textAlign: 'center',
    fontSize: 13,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.accent}15`,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  filterBtnText: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  filterMenuContainer: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  filterMenuTitle: {
    ...typography.heading,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterOptionActive: {
    backgroundColor: `${colors.accent}10`,
    borderRadius: radius.sm,
    borderBottomWidth: 0,
  },
  filterOptionText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  filterOptionTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  customDateText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '500',
  },
  expandedItem: {
    backgroundColor: `${colors.surface}`,
  },
  expandedContent: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    width: '100%',
  },
  expandedRow: {
    marginBottom: spacing.sm,
  },
  expandedLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 2,
  },
  expandedValue: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  viewProfileBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.primary}15`,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
    marginRight: spacing.sm,
  },
  viewProfileText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
    marginLeft: spacing.sm,
  },
  deletePaymentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.danger}15`,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
  },
  deletePaymentText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 14,
    marginLeft: spacing.sm,
  },
  paginationContainer: {
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
    gap: spacing.md,
  },
  paginationInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  paginationInfoText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  modeTabActive: {
    backgroundColor: colors.primary,
  },
  modeTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modeTabTextActive: {
    color: colors.textInverted,
  },
  pageButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.xs,
  },
  pageNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNavBtnDisabled: {
    opacity: 0.4,
  },
  pageBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnActive: {
    backgroundColor: colors.primary + '18',
    borderColor: colors.primary,
  },
  pageBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  pageBtnTextActive: {
    color: colors.primary,
  },
  pageEllipsis: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageEllipsisText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
});
