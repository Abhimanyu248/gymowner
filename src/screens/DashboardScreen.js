import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions, TouchableOpacity, Pressable, Animated, Easing } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import MetricCard from '../components/MetricCard';
import { radius, spacing, shadows } from '../theme/theme';
import { useThemeColors } from '../theme/palette';
import { LineChart } from 'react-native-chart-kit';
import { Circle, G } from 'react-native-svg';

const screenWidth = Dimensions.get('window').width;
const yAxisWidth = 56;
const chartContentWidth = Math.max(screenWidth - spacing.md * 2 - yAxisWidth - 2, 780);

export default function DashboardScreen() {
  const { dashboardStats, paymentStats, payments, members, isLoadingData, fetchAppData, user } = useAppStore();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const [methodFilter, setMethodFilter] = React.useState('all');
  const [selectedPoint, setSelectedPoint] = React.useState(null);
  const [selectedPointMeta, setSelectedPointMeta] = React.useState(null);
  const renderDot = React.useCallback(({ x, y, index, indexData }) => {
    return (
      <G key={`dot-target-${index}`}>
        {/* Small visible dot */}
        <Circle
          cx={x}
          cy={y}
          r={4}
          fill={colors.primary}
          stroke={colors.surface}
          strokeWidth={2}
        />
        {/* Invisible large touch target (48px diameter) */}
        <Circle
          cx={x}
          cy={y}
          r={24}
          fill="transparent"
          onPress={() => {
            setSelectedPoint({ 
              value: indexData, 
              month: chartData[index]?.month || '', 
              x, 
              y 
            });
            setSelectedPointMeta({ x, y });
          }}
        />
      </G>
    );
  }, [colors, chartData]);
  const [statsRange, setStatsRange] = React.useState('today');
  const [animatedPoints, setAnimatedPoints] = React.useState(new Array(12).fill(0));
  const [animatedMonthRevenue, setAnimatedMonthRevenue] = React.useState(0);
  const chartScrollRef = React.useRef(null);
  const chartOpacity = React.useRef(new Animated.Value(0)).current;
  const chartTranslateY = React.useRef(new Animated.Value(12)).current;
  const chartScale = React.useRef(new Animated.Value(0.98)).current;
  const pulse = React.useRef(new Animated.Value(0)).current;
  const pointsAnimRef = React.useRef({
    frame: null,
    start: 0,
    from: new Array(12).fill(0),
    to: new Array(12).fill(0),
    duration: 560,
  });

  const onRefresh = React.useCallback(() => {
    fetchAppData();
  }, [fetchAppData]);

  const stats = dashboardStats || {
    totalMembers: 0,
    activeMembers: 0,
    expiredMembers: 0,
    expiringSoonMembers: 0,
    newMembersThisMonth: 0,
  };
  const monthNames = React.useMemo(
    () => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    []
  );

  // ─── Locally computed revenue summary using device local time ──────────────
  // Avoids server/client timezone mismatch — all date boundaries use the
  // device's local midnight, so "today" and "this month" are always correct.
  const revSummary = React.useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(now.getDate() - daysFromMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    let today = 0, week = 0, month = 0, year = 0;
    (payments || []).forEach((p) => {
      const amount = Number(p?.amount) || 0;
      const rawDate = p?.paidOn || p?.createdAt;
      const d = rawDate ? new Date(rawDate) : null;
      if (!d || Number.isNaN(d.getTime())) return;
      if (d >= startOfYear) year += amount;
      if (d >= startOfMonth) month += amount;
      if (d >= startOfWeek) week += amount;
      if (d >= startOfDay) today += amount;
    });
    return { today, week, month, year };
  }, [payments]);

  // ─── Locally computed new-members-this-month ────────────────────────────
  // Counts unique members who have at least one payment this month.
  // Using payments instead of joinDate avoids inflated counts from
  // restored members whose joinDate falls in the current month.
  const newMembersThisMonth = React.useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const uniqueMembers = new Set();
    (payments || []).forEach((p) => {
      const rawDate = p?.paidOn || p?.createdAt;
      if (!rawDate) return;
      const d = new Date(rawDate);
      if (Number.isNaN(d.getTime()) || d < startOfMonth || d > now) return;
      const mid = typeof p?.memberId === 'object'
        ? (p.memberId?._id || p.memberId?.id)
        : p?.memberId;
      if (mid) uniqueMembers.add(String(mid));
    });
    return uniqueMembers.size;
  }, [payments]);

  const chartData = React.useMemo(() => {
    const monthlyRevenue = new Array(12).fill(0);
    const year = new Date().getFullYear();

    (payments || []).forEach((p) => {
      if (methodFilter !== 'all' && p?.paymentMethod !== methodFilter) return;
      // Use createdAt as fallback when paidOn is absent
      const rawDate = p?.paidOn || p?.createdAt;
      const paidDate = rawDate ? new Date(rawDate) : null;
      if (!paidDate || Number.isNaN(paidDate.getTime()) || paidDate.getFullYear() !== year) return;

      const amount = Number(p?.amount) || 0;
      monthlyRevenue[paidDate.getMonth()] += amount;
    });

    return monthlyRevenue.map((revenue, idx) => ({ month: monthNames[idx], revenue }));
  }, [payments, methodFilter, monthNames]);

  const maxRevenue = React.useMemo(
    () => Math.max(0, ...chartData.map((d) => Number(d.revenue) || 0)),
    [chartData]
  );

  const yAxisMax = React.useMemo(() => {
    const paddedMax = maxRevenue > 0 ? maxRevenue * 1.2 : 2000;
    return Math.ceil(paddedMax / 100) * 100;
  }, [maxRevenue]);

  const yAxisTicks = React.useMemo(() => {
    const steps = 5;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const value = Math.round((yAxisMax * (steps - i)) / steps);
      return value;
    });
  }, [yAxisMax]);

  const joinedAndPaymentStatsFallback = React.useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(now.getDate() - daysFromMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const rangeStart =
      statsRange === 'today'
        ? startOfDay
        : statsRange === 'week'
          ? startOfWeek
          : statsRange === 'month'
            ? startOfMonth
            : startOfYear;
    const rangeEnd = now;
    const toValidDate = (value) => {
      if (!value) return null;
      const direct = new Date(value);
      if (!Number.isNaN(direct.getTime())) return direct;
      if (typeof value === 'string') {
        const m = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
        if (m) {
          const dd = Number(m[1]);
          const mm = Number(m[2]) - 1;
          const yy = Number(m[3]);
          const fallback = new Date(yy, mm, dd);
          if (!Number.isNaN(fallback.getTime())) return fallback;
        }
      }
      return null;
    };

    // Count unique members who have at least one payment in this period.
    // This avoids inflated counts from restored members whose joinDate
    // falls in the current range but whose payments are from an older period.
    const membersWithPaymentInRange = new Set();
    let paymentsReceived = 0;

    (payments || []).forEach((p) => {
      const rawDate = p?.paidOn || p?.createdAt;
      const d = toValidDate(rawDate);
      if (!d || d < rangeStart || d > rangeEnd) return;
      paymentsReceived += (Number(p?.amount) || 0);
      // Track the member who made this payment
      const mid = typeof p?.memberId === 'object'
        ? (p.memberId?._id || p.memberId?.id)
        : p?.memberId;
      if (mid) membersWithPaymentInRange.add(String(mid));
    });

    const joinedMembers = membersWithPaymentInRange.size;

    return { joinedMembers, paymentsReceived };
  }, [statsRange, members, payments]);

  // Always compute range stats locally — prevents server timezone from
  // giving a different "today" / "this month" window than the user expects.
  const joinedAndPaymentStats = joinedAndPaymentStatsFallback;

  React.useEffect(() => {
    if (!chartScrollRef.current) return;
    const monthIndex = new Date().getMonth();
    const x = Math.max(0, (chartContentWidth / 12) * monthIndex - chartContentWidth / 6);
    chartScrollRef.current.scrollTo({ x, animated: true });
  }, []);

  React.useEffect(() => {
    setSelectedPoint(null);
    setSelectedPointMeta(null);
  }, [methodFilter]);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(chartOpacity, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(chartTranslateY, {
        toValue: 0,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [chartOpacity, chartTranslateY]);

  React.useEffect(() => {
    const target = chartData.map((d) => d.revenue || 0);
    const anim = pointsAnimRef.current;
    if (anim.frame) cancelAnimationFrame(anim.frame);

    const current = animatedPoints.length === target.length ? animatedPoints : new Array(target.length).fill(0);
    const changed = current.some((v, i) => Math.round(v) !== Math.round(target[i]));
    if (!changed) {
      setAnimatedPoints(target);
      return;
    }

    anim.start = Date.now();
    anim.from = current;
    anim.to = target;
    chartScale.setValue(0.985);
    Animated.timing(chartScale, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const step = () => {
      const elapsed = Date.now() - anim.start;
      const t = Math.min(1, elapsed / anim.duration);
      const e = easeOutCubic(t);
      const next = anim.to.map((toV, i) => {
        const fromV = anim.from[i] || 0;
        return fromV + (toV - fromV) * e;
      });
      setAnimatedPoints(next);
      if (t < 1) {
        anim.frame = requestAnimationFrame(step);
      }
    };
    anim.frame = requestAnimationFrame(step);
    return () => {
      if (anim.frame) cancelAnimationFrame(anim.frame);
    };
  }, [chartData]);

  React.useEffect(() => {
    const target = Number(revSummary.month) || 0;
    const start = Number(animatedMonthRevenue) || 0;
    const duration = 880;
    const t0 = Date.now();
    let raf = null;
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const tick = () => {
      const t = Math.min(1, (Date.now() - t0) / duration);
      const v = start + (target - start) * easeOut(t);
      setAnimatedMonthRevenue(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [revSummary.month]);

  React.useEffect(() => {
    if (!selectedPointMeta) return;
    pulse.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 560,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
    return () => {
      pulse.stopAnimation();
    };
  }, [selectedPointMeta, pulse]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.primary} />}
      contentContainerStyle={{ paddingBottom: 100 }}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}, {user?.name.toUpperCase() || 'Admin'}  </Text>
          <Text style={styles.date}>{new Date().toDateString()}</Text>
        </View>
        {/* <View style={styles.avatarBubble}>
          <Text style={styles.avatarLetter}>{(user?.name || 'A')[0].toUpperCase()}</Text>
        </View> */}
      </View>

      <View style={styles.banner}>
        <View>
          <Text style={styles.bannerLabel}>ACTIVE MEMBERS</Text>
          <Text style={[styles.bannerValue, { color: colors.success }]}>{stats.activeMembers}</Text>
        </View>
        <View style={styles.bannerDivider} />
        <View>
          <Text style={styles.bannerLabel}>THIS MONTH</Text>
          <Text style={[styles.bannerValue, { color: colors.secondary }]}>Rs {Math.round(animatedMonthRevenue).toLocaleString()}</Text>
        </View>
        <View style={styles.bannerDivider} />
        <View>
          <Text style={styles.bannerLabel}>EXPIRED</Text>
          <Text style={[styles.bannerValue, { color: colors.danger }]}>{stats.expiredMembers}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.metricsRow}>
        <MetricCard title="Total Members" value={stats.totalMembers} color={colors.primary} />
        <MetricCard title="Expiring in 4 Days" value={stats.expiringSoonMembers || 0} color={colors.warning} />
      </View>
      <View style={styles.metricsRow}>
        <MetricCard title="New This Month" value={newMembersThisMonth} color={colors.success} />
        <MetricCard title="Today's Rev." value={`Rs ${revSummary.today.toLocaleString()}`} color={colors.secondary} />
      </View>

      <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Monthly Revenue</Text>
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

      <Animated.View
        style={[
          styles.chartContainer,
          { opacity: chartOpacity, transform: [{ translateY: chartTranslateY }, { scale: chartScale }] },
        ]}
      >
        <View style={styles.chartRow}>
          <View style={styles.yAxisColumn}>
            {yAxisTicks.map((tick, idx) => (
              <Text key={`${tick}-${idx}`} style={styles.yAxisTickText}>
                Rs {tick}
              </Text>
            ))}
          </View>
          <ScrollView
            ref={chartScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.chartScrollContent}
            onScrollBeginDrag={() => {
              setSelectedPoint(null);
              setSelectedPointMeta(null);
            }}
          >
            <Pressable
              style={styles.chartPlotWrapper}
              onPress={() => {
                setSelectedPoint(null);
                setSelectedPointMeta(null);
              }}
            >
              <LineChart
                data={{
                  labels: chartData.map((d) => d.month),
                  datasets: [
                    { data: animatedPoints.map((v) => Math.max(0, Number(v) || 0)) },
                    {
                      // Invisible guard dataset to force chart scaling to Y-axis max.
                      data: new Array(12).fill(yAxisMax),
                      color: () => 'rgba(0,0,0,0)',
                      strokeWidth: 0,
                      withDots: false,
                    },
                  ],
                }}
                width={chartContentWidth}
                height={220}
                yAxisLabel=""
                withVerticalLabels
                withHorizontalLabels={false}
                formatXLabel={(label) => label}
                renderDotContent={renderDot}
                chartConfig={{
                  backgroundColor: colors.surface,
                  backgroundGradientFrom: colors.surface,
                  backgroundGradientTo: colors.surfaceAlt,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
                  labelColor: () => colors.textSecondary,
                  style: { borderRadius: radius.card },
                  propsForBackgroundLines: { stroke: colors.border },
                }}
                bezier
                style={{ borderRadius: radius.card }}
              />
              {selectedPoint && (
                <View
                  style={[
                    styles.tooltip,
                    {
                      left: Math.max(8, Math.min((selectedPoint.x || 0) - 56, chartContentWidth - 112)),
                      top: Math.max(8, (selectedPoint.y || 40) - 44),
                    },
                  ]}
                >
                  <Text style={styles.tooltipText}>
                    {selectedPoint.month}: Rs {Math.round(selectedPoint.value)}
                  </Text>
                </View>
              )}
              {selectedPointMeta && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.touchPulse,
                    {
                      left: Math.max(0, (selectedPointMeta.x || 0) - 11),
                      top: Math.max(0, (selectedPointMeta.y || 0) - 11),
                      transform: [
                        {
                          scale: pulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.9, 1.8],
                          }),
                        },
                      ],
                      opacity: pulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.45, 0],
                      }),
                    },
                  ]}
                />
              )}
            </Pressable>
          </ScrollView>
        </View>
      </Animated.View>

      <View style={styles.statsPanel}>
        <View style={styles.statsTabs}>
          {[
            { key: 'today', label: 'Today' },
            { key: 'week', label: 'This Week' },
            { key: 'month', label: 'This Month' },
            { key: 'year', label: 'This Year' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.statsTabBtn, statsRange === tab.key && styles.statsTabBtnActive]}
              onPress={() => setStatsRange(tab.key)}
              activeOpacity={0.85}
            >
              <Text style={[styles.statsTabText, statsRange === tab.key && styles.statsTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.statsCardsRow}>
          <View style={styles.statsCard}>
            <Text style={styles.statsValue}>{joinedAndPaymentStats.joinedMembers}</Text>
            <Text style={styles.statsLabel}>Members Joined</Text>
          </View>
          <View style={styles.statsCard}>
            <Text style={styles.statsValue}>Rs {joinedAndPaymentStats.paymentsReceived.toLocaleString()}</Text>
            <Text style={styles.statsLabel}>Payments Received</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'Poppins-Bold',
    color: colors.textPrimary,
  },
  date: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 3,
  },
  avatarBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.primary}30`,
    borderWidth: 1,
    borderColor: `${colors.primary}60`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  banner: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  bannerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
    textAlign: 'center',
  },
  bannerValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  bannerDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    marginBottom: spacing.xxl,
    overflow: 'hidden',
    ...shadows.sm,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  yAxisColumn: {
    width: yAxisWidth,
    height: 220,
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 40,
    paddingLeft: 4,
  },
  yAxisTickText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  chartScrollContent: {
    paddingRight: spacing.sm,
  },
  chartPlotWrapper: {
    position: 'relative',
    width: chartContentWidth,
    height: 220,
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: colors.textPrimary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: 112,
  },
  tooltipText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: '700',
  },
  touchPulse: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
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
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}20`,
  },
  filterChipText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: colors.primary,
  },
  statsPanel: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: spacing.xl,
    ...shadows.sm,
  },
  statsTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: 12,
  },
  statsTabBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  statsTabBtnActive: {
    backgroundColor: colors.background === '#141A22' ? '#3A4250' : '#D8DEE7',
  },
  statsTabText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  statsTabTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  statsCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  statsCard: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    alignItems: 'center',
  },
  statsValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statsLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 3,
    fontWeight: '600',
  },
});
