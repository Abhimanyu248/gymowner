import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, TextInput, StyleSheet, FlatList, TouchableOpacity,
  Text, Modal, Animated, Pressable,
  ScrollView, Platform, PanResponder,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../store/useAppStore';
import MemberCard from '../components/MemberCard';
import { radius, spacing, shadows } from '../theme/theme';
import { useThemeColors } from '../theme/palette';
import { calculateDaysLeft } from '../utils/memberUtils';
import { Type, CalendarClock, CalendarDays, Timer, Calendar, Check, X, Search, SlidersHorizontal, Plus, Users, CalendarArrowDown, CalendarArrowUp, ArrowDownAZ, ArrowDownZA, ChevronLeft, ChevronRight } from 'lucide-react-native';

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

// ─── Sort / Filter constants ────────────────────────────────────────────────
const SORT_OPTIONS = [
  { key: 'nameAsc',     label: 'Name',           sub: 'A to Z',          Icon: ArrowDownAZ },
  { key: 'nameDesc',    label: 'Name',           sub: 'Z to A',          Icon: ArrowDownZA },
  { key: 'expiryAsc',   label: 'Expiry Date',    sub: 'Latest first',    Icon: CalendarArrowDown },
  { key: 'expiryDesc',  label: 'Expiry Date',    sub: 'Oldest first',    Icon: CalendarArrowUp },
  { key: 'joinAsc',     label: 'Joining Date',   sub: 'Oldest first',    Icon: CalendarDays },
  { key: 'joinDesc',    label: 'Joining Date',   sub: 'Newest first',    Icon: CalendarDays },
  { key: 'planAsc',     label: 'Plan Duration',  sub: 'Shortest first',  Icon: Timer },
  { key: 'planDesc',    label: 'Plan Duration',  sub: 'Longest first',   Icon: Timer },
];

function parseLocalDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function formatDisplayDate(str) {
  const d = parseLocalDate(str);
  if (!d) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateISO(d) {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getPlanDuration(member) {
  // Use planId.durationMonths directly — no string parsing
  const months = member.planId?.durationMonths ?? member.planDuration ?? null;
  if (months != null) return Number(months);
  return 0;
}

// ─── Sort & Filter Bottom Sheet ─────────────────────────────────────────────
function SortFilterSheet({
  visible, onClose,
  sortKey, setSortKey,
  filterStartDate, setFilterStartDate,
  filterEndDate, setFilterEndDate,
  filterExpiryDays, setFilterExpiryDays,
  colors, insets
}) {
  // Single translateY drives everything: open spring, drag tracking, close animation
  // Replaces the old Animated.add(slideAnim.interpolate, dragY) which caused a
  // one-frame snap-back flash (dragY.setValue(0) fired before modal hide)
  const translateY   = useRef(new Animated.Value(700)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const [localSort, setLocalSort] = useState(sortKey);
  const [localStartDate, setLocalStartDate] = useState(filterStartDate ? new Date(filterStartDate) : null);
  const [localEndDate, setLocalEndDate] = useState(filterEndDate ? new Date(filterEndDate) : null);
  const [localExpiryDays, setLocalExpiryDays] = useState(filterExpiryDays || '');
  const [showPicker, setShowPicker] = useState(null);

  // Open animation — runs whenever visible flips to true
  useEffect(() => {
    if (visible) {
      setLocalSort(sortKey);
      setLocalStartDate(filterStartDate ? new Date(filterStartDate) : null);
      setLocalEndDate(filterEndDate ? new Date(filterEndDate) : null);
      setLocalExpiryDays(filterExpiryDays || '');
      translateY.setValue(700);
      backdropAnim.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Dismiss — animates sheet off screen THEN calls onClose (no flash)
  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 700,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  }, [onClose]);

  // Swipe-down gesture — attached only to the handle bar
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 4,
      onMoveShouldSetPanResponderCapture: (_, gs) => gs.dy > 4,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.5) {
          // Past threshold — animate off screen then close (no setValue reset = no flash)
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: 700,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(backdropAnim, {
              toValue: 0,
              duration: 180,
              useNativeDriver: true,
            }),
          ]).start(() => onClose());
        } else {
          // Not far enough — spring back to open position
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 14,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  function apply() {
    setSortKey(localSort);
    setFilterStartDate(formatDateISO(localStartDate));
    setFilterEndDate(formatDateISO(localEndDate));
    setFilterExpiryDays(localExpiryDays);
    dismiss();
  }

  // Reset local state variables
  function reset() {
    setLocalSort(null);
    setLocalStartDate(null);
    setLocalEndDate(null);
    setLocalExpiryDays('');
  }

  const hasActive = localSort || localStartDate || localEndDate || localExpiryDays;
  const s = sheetStyles(colors, insets);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[s.sheet, { transform: [{ translateY }] }]}>
        {/* Draggable handle */}
        <View {...panResponder.panHandlers} style={s.handleArea}>
          <View style={s.handle} />
        </View>

        {/* Header */}
        <View style={s.sheetHeader}>
          <Text style={s.sheetTitle}>Sort & Filter</Text>
          {hasActive ? (
            <TouchableOpacity onPress={reset} style={s.resetBtn}>
              <Text style={s.resetText}>Reset all</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
          <Text style={s.sectionLabel}>SORT BY</Text>
          <View style={s.sortGrid}>
            {SORT_OPTIONS.map(opt => {
              const active = localSort === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.sortChip, active && s.sortChipActive]}
                  onPress={() => setLocalSort(active ? null : opt.key)}
                  activeOpacity={0.75}
                >
                  <View style={{ width: 24, alignItems: 'center' }}>
                    <opt.Icon size={18} color={active ? colors.primary : colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.sortChipLabel, active && s.sortChipLabelActive]}>{opt.label}</Text>
                    <Text style={[s.sortChipSub, active && s.sortChipSubActive]}>{opt.sub}</Text>
                  </View>
                  {active && <Check size={18} color={colors.primary} strokeWidth={3} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[s.sectionLabel, { marginTop: 20 }]}>FILTER BY JOIN DATE</Text>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={[s.dateRow, { flex: 1, paddingHorizontal: 8 }]} onPress={() => setShowPicker('start')} activeOpacity={0.8}>
              <Calendar size={18} color={colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={[s.dateValueText, !localStartDate && { color: colors.textMuted }, { fontSize: 13 }]}>
                {localStartDate ? formatDisplayDate(formatDateISO(localStartDate)) : 'Start date'}
              </Text>
              {localStartDate ? (
                <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); setLocalStartDate(null); }} style={s.clearDate} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>

            <TouchableOpacity style={[s.dateRow, { flex: 1, paddingHorizontal: 8 }]} onPress={() => setShowPicker('end')} activeOpacity={0.8}>
              <Calendar size={18} color={colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={[s.dateValueText, !localEndDate && { color: colors.textMuted }, { fontSize: 13 }]}>
                {localEndDate ? formatDisplayDate(formatDateISO(localEndDate)) : 'End date'}
              </Text>
              {localEndDate ? (
                <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); setLocalEndDate(null); }} style={s.clearDate} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          </View>

          {showPicker && (
            <DateTimePicker
              value={showPicker === 'start' ? (localStartDate || new Date()) : (localEndDate || new Date())}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              maximumDate={new Date()}
              minimumDate={showPicker === 'end' && localStartDate ? localStartDate : undefined}
              onChange={(_, selected) => {
                if (Platform.OS === 'android') {
                  const currentPicker = showPicker;
                  setShowPicker(null);
                  if (selected) {
                    if (currentPicker === 'start') setLocalStartDate(selected);
                    else setLocalEndDate(selected);
                  }
                } else {
                  if (selected) {
                    if (showPicker === 'start') setLocalStartDate(selected);
                    else setLocalEndDate(selected);
                  }
                }
              }}
              themeVariant={colors.background === '#141A22' ? 'dark' : 'light'}
              style={{ marginTop: 8 }}
            />
          )}
          {Platform.OS === 'ios' && showPicker && (
            <TouchableOpacity style={s.pickerDoneBtn} onPress={() => setShowPicker(null)}>
              <Text style={s.pickerDoneText}>Done</Text>
            </TouchableOpacity>
          )}

          <Text style={[s.sectionLabel, { marginTop: 20 }]}>FILTER BY EXPIRY DAYS LEFT</Text>
          <View style={{ position: 'relative', justifyContent: 'center' }}>
            <TextInput
              style={[s.input, { paddingRight: 40 }]}
              placeholder="e.g. 7"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={localExpiryDays}
              onChangeText={(val) => setLocalExpiryDays(val.replace(/[^0-9]/g, ''))}
            />
            {!!localExpiryDays && (
              <TouchableOpacity
                onPress={() => setLocalExpiryDays('')}
                style={{
                  position: 'absolute',
                  right: 12,
                  height: 48,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        <View style={s.applyWrap}>
          <TouchableOpacity style={s.applyBtn} onPress={apply} activeOpacity={0.85}>
            <Text style={s.applyText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function MembersScreen({ navigation }) {
  const { members, deletedMembers, isLoadingData, fetchAppData } = useAppStore();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const styles = getStyles(colors, insets);

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sortKey, setSortKey] = useState(null);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterExpiryDays, setFilterExpiryDays] = useState('');

  // Pagination states
  const [isPaginated, setIsPaginated] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // Automatically reset to page 1 when any filter, search, or sort option changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filter, filterStartDate, filterEndDate, filterExpiryDays, sortKey]);

  const hasActiveSort = !!sortKey;
  const hasActiveFilter = !!filterStartDate || !!filterEndDate || !!filterExpiryDays;
  const badgeCount = (hasActiveSort ? 1 : 0) + (hasActiveFilter ? 1 : 0);

  // Memoized filtered + sorted list — only recomputes when data/search/filter/sort changes
  // NOT when sheetVisible toggles, preventing FlatList re-renders on modal close
  const result = useMemo(() => {
    // Choose source list based on active filter
    const sourceList = filter === 'Deleted' ? deletedMembers : members;

    // 1️⃣ Status + search filter
    let filtered = sourceList.filter(member => {
      const matchSearch =
        member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (member.phone != null && String(member.phone).includes(searchQuery));
      if (!matchSearch) return false;

      const daysLeft = calculateDaysLeft(member.expiryDate);
      const isExpired = daysLeft !== null && daysLeft < 0;
      const isExpireSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 4;
      if (filter === 'Active' && isExpired) return false;
      if (filter === 'Expired' && !isExpired) return false;
      if (filter === 'Expire Soon' && !isExpireSoon) return false;
      return true;
    });

    // 2️⃣ Date filter
    if (filterStartDate || filterEndDate) {
      filtered = filtered.filter(m => {
        const jd = m.joinDate || m.joiningDate;
        if (!jd) return false;
        const parsedDate = parseLocalDate(jd);
        if (!parsedDate) return false;
        
        const dTime = parsedDate.getTime();
        const start = filterStartDate ? parseLocalDate(filterStartDate).getTime() : 0;
        let end = filterEndDate ? parseLocalDate(filterEndDate).getTime() : Infinity;
        if (filterEndDate) end += 24 * 60 * 60 * 1000 - 1; // End of the day
        
        return dTime >= start && dTime <= end;
      });
    }

    // 2️⃣.5️⃣ Expiry days left filter
    if (filterExpiryDays !== '' && filterExpiryDays !== null && filterExpiryDays !== undefined) {
      const maxDays = parseInt(filterExpiryDays, 10);
      if (!isNaN(maxDays)) {
        filtered = filtered.filter(m => {
          const daysLeft = calculateDaysLeft(m.expiryDate);
          return daysLeft !== null && daysLeft >= 0 && daysLeft <= maxDays;
        });
      }
    }

    // 3️⃣ Sort
    if (sortKey) {
      filtered = [...filtered].sort((a, b) => {
        if (sortKey === 'nameAsc' || sortKey === 'nameDesc') {
          const nameA = a.name?.toLowerCase() || '';
          const nameB = b.name?.toLowerCase() || '';
          if (nameA < nameB) return sortKey === 'nameAsc' ? -1 : 1;
          if (nameA > nameB) return sortKey === 'nameAsc' ? 1 : -1;
          return 0;
        }
        if (sortKey === 'expiryAsc' || sortKey === 'expiryDesc') {
          const da = parseLocalDate(a.expiryDate)?.getTime() ?? Infinity;
          const db = parseLocalDate(b.expiryDate)?.getTime() ?? Infinity;
          return sortKey === 'expiryAsc' ? da - db : db - da;
        }
        if (sortKey === 'joinAsc' || sortKey === 'joinDesc') {
          const da = parseLocalDate(a.joinDate || a.joiningDate)?.getTime() ?? 0;
          const db = parseLocalDate(b.joinDate || b.joiningDate)?.getTime() ?? 0;
          return sortKey === 'joinAsc' ? da - db : db - da;
        }
        if (sortKey === 'planAsc' || sortKey === 'planDesc') {
          const pa = getPlanDuration(a);
          const pb = getPlanDuration(b);
          return sortKey === 'planAsc' ? pa - pb : pb - pa;
        }
        return 0;
      });
    }

    return filtered;
  }, [members, deletedMembers, searchQuery, filter, filterStartDate, filterEndDate, filterExpiryDays, sortKey]);

  const totalPages = isPaginated ? Math.ceil(result.length / 10) : 1;
  const activePage = Math.min(Math.max(currentPage, 1), totalPages || 1);

  // Memoized paginated result slice
  const paginatedResult = useMemo(() => {
    if (!isPaginated) return result;
    const startIndex = (activePage - 1) * 10;
    return result.slice(startIndex, startIndex + 10);
  }, [result, isPaginated, activePage]);

  // Memoized counts — only recalculates when members list changes
  const counts = useMemo(() => ({
    All: members.length,
    Active: members.filter(m => { const d = calculateDaysLeft(m.expiryDate); return d !== null && d >= 0; }).length,
    Expired: members.filter(m => { const d = calculateDaysLeft(m.expiryDate); return d !== null && d < 0; }).length,
    'Expire Soon': members.filter(m => { const d = calculateDaysLeft(m.expiryDate); return d !== null && d >= 0 && d <= 4; }).length,
    Deleted: deletedMembers.length,
  }), [members, deletedMembers]);

  // Stable renderItem — won't cause FlatList to re-render items when sheetVisible toggles
  const renderItem = useCallback(({ item }) => (
    <MemberCard
      member={item}
      onPress={() => navigation.navigate('MemberDetail', { memberId: item.id })}
    />
  ), [navigation]);

  // FilterChip — stable per filter/counts change only
  const FilterChip = useCallback(({ label }) => (
    <TouchableOpacity
      style={[styles.chip, filter === label && styles.chipActive]}
      onPress={() => setFilter(label)}
    >
      <Text style={[styles.chipText, filter === label && styles.chipTextActive]}>{label}</Text>
      <View style={[styles.chipCount, filter === label && styles.chipCountActive]}>
        <Text style={[styles.chipCountText, filter === label && styles.chipCountTextActive]}>
          {counts[label]}
        </Text>
      </View>
    </TouchableOpacity>
  ), [filter, counts, styles]);

  // Pagination Footer
  const renderFooter = useCallback(() => {
    if (result.length === 0) return null;

    const startItem = (activePage - 1) * 10 + 1;
    const endItem = Math.min(activePage * 10, result.length);

    return (
      <View style={styles.paginationContainer}>
        {/* Mode selector and info row */}
        <View style={styles.paginationInfoRow}>
          <Text style={styles.paginationInfoText}>
            {isPaginated 
              ? `Showing ${startItem}-${endItem} of ${result.length} members`
              : `Showing all ${result.length} members`
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
              <ChevronLeft size={18} color={activePage === 1 ? colors.textMuted : colors.primary} />
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
              <ChevronRight size={18} color={activePage === totalPages ? colors.textMuted : colors.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }, [result.length, activePage, isPaginated, totalPages, colors, styles]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {/* Search row */}
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <Search size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchBar}
              placeholder="Search by name or phone..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Sort/Filter button */}
          <TouchableOpacity
            style={[styles.sfBtn, badgeCount > 0 && styles.sfBtnActive]}
            onPress={() => setSheetVisible(true)}
            activeOpacity={0.8}
          >
            <SlidersHorizontal size={16} color={badgeCount > 0 ? colors.primary : colors.textSecondary} />
            {/* <Text style={[styles.sfLabel, badgeCount > 0 && styles.sfLabelActive]}>Filter</Text> */}
            {badgeCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badgeCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Status chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          <FilterChip label="All" />
          <FilterChip label="Active" />
          <FilterChip label="Expired" />
          <FilterChip label="Expire Soon" />
          <FilterChip label="Deleted" />
        </ScrollView>

        {/* Active sort/filter summary */}
        {(sortKey || filterStartDate || filterEndDate || filterExpiryDays) && (
          <View style={styles.activeSummary}>
            {sortKey && (
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>
                  {SORT_OPTIONS.find(o => o.key === sortKey)?.label} · {SORT_OPTIONS.find(o => o.key === sortKey)?.sub}
                </Text>
                <TouchableOpacity onPress={() => setSortKey(null)} style={{ marginLeft: 6 }}>
                  <X size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>
            )}
            {(filterStartDate || filterEndDate) && (
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>
                  {filterStartDate === filterEndDate && filterStartDate 
                    ? `Joined ${formatDisplayDate(filterStartDate)}` 
                    : `Joined ${filterStartDate ? formatDisplayDate(filterStartDate) : '...'} - ${filterEndDate ? formatDisplayDate(filterEndDate) : '...'}`}
                </Text>
                <TouchableOpacity onPress={() => { setFilterStartDate(''); setFilterEndDate(''); }} style={{ marginLeft: 6 }}>
                  <X size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>
            )}
            {!!filterExpiryDays && (
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>
                  Expires in ≤ {filterExpiryDays} days
                </Text>
                <TouchableOpacity onPress={() => setFilterExpiryDays('')} style={{ marginLeft: 6 }}>
                  <X size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      <FlatList
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        data={paginatedResult}
        keyExtractor={item => item._id || item.id}
        contentContainerStyle={styles.list}
        refreshing={false}
        onRefresh={fetchAppData}
        renderItem={renderItem}
        ListFooterComponent={renderFooter}
        removeClippedSubviews
        windowSize={7}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Users size={48} color={colors.textMuted} style={{ marginBottom: spacing.sm }} />
            <Text style={styles.emptyTitle}>No members found</Text>
            <Text style={styles.emptyText}>Try adjusting the search or filter</Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddEditMember')}
        activeOpacity={0.8}
      >
        <Plus size={28} color="#fff" />
      </TouchableOpacity>


      {/* Bottom Sheet */}
      <SortFilterSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        sortKey={sortKey}
        setSortKey={setSortKey}
        filterStartDate={filterStartDate}
        setFilterStartDate={setFilterStartDate}
        filterEndDate={filterEndDate}
        setFilterEndDate={setFilterEndDate}
        filterExpiryDays={filterExpiryDays}
        setFilterExpiryDays={setFilterExpiryDays}
        colors={colors}
        insets={insets}
      />
    </View>
  );
}

// ─── Sheet Styles ─────────────────────────────────────────────────────────────
const sheetStyles = (colors, insets) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '80%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: spacing.md,
    paddingBottom: Math.max(insets?.bottom || 0, 16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  resetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    height: 48,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceAlt,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  sortGrid: {
    gap: 8,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 10,
  },
  sortChipActive: {
    backgroundColor: colors.primary + '18',
    borderColor: colors.primary,
  },
  sortChipIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  sortChipLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sortChipLabelActive: {
    color: colors.primary,
  },
  sortChipSub: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
    marginTop: 1,
  },
  sortChipSubActive: {
    color: colors.primary + 'BB',
  },
  checkIcon: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  handleArea: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: -4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
  },
  dateIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  dateValueText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dateChevron: {
    fontSize: 20,
    color: colors.textMuted,
    fontWeight: '300',
  },
  clearDate: {
    padding: 4,
  },
  clearDateText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  datePreview: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
    paddingLeft: 4,
  },
  pickerDoneBtn: {
    alignSelf: 'flex-end',
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primary + '20',
  },
  pickerDoneText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  applyWrap: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
  },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.btn,
    paddingVertical: 14,
    alignItems: 'center',
    ...shadows.glow,
  },
  applyText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

// ─── Screen Styles ────────────────────────────────────────────────────────────
const getStyles = (colors, insets) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginTop: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.sm,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchBar: { flex: 1, height: 44, color: colors.textPrimary, fontSize: 14 },
  sfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  sfBtnActive: {
    backgroundColor: colors.primary + '18',
    borderColor: colors.primary,
  },
  sfIcon: { fontSize: 16, color: colors.textSecondary, fontWeight: '800' },
  sfIconActive: { color: colors.primary },
  sfLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  sfLabelActive: { color: colors.primary },
  badge: {
    marginLeft: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  filters: { flexDirection: 'row', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 5,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  chipCount: {
    backgroundColor: colors.border,
    borderRadius: radius.full,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  chipCountActive: { backgroundColor: '#FFFFFF' },
  chipCountText: { fontSize: 10, fontWeight: '800', color: colors.textMuted },
  chipCountTextActive: { color: colors.accent },
  activeSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.primary + '18',
    borderWidth: 1,
    borderColor: colors.primary + '44',
  },
  activePillText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  activePillX: { fontSize: 11, fontWeight: '800', color: colors.primary },
  list: { padding: spacing.md, paddingBottom: 100 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.sm },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  emptyText: { fontSize: 13, color: colors.textMuted },
  fab: {
    position: 'absolute',
    bottom: Math.max(spacing.lg, (insets?.bottom || 0) + 88),
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    elevation: 20,
    ...shadows.glow,
  },
  fabIcon: { fontSize: 28, color: '#fff', lineHeight: 32, fontWeight: '300' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
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
