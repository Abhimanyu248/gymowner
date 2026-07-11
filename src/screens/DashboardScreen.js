import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions, TouchableOpacity, Pressable, Animated, Easing, Modal } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import MetricCard from '../components/MetricCard';
import AppBackground from '../components/AppBackground';
import { radius, spacing, shadows } from '../theme/theme';
import { useThemeColors } from '../theme/palette';
import { LineChart } from 'react-native-chart-kit';
import Svg, { Path, Circle, G, Line, Text as SvgText } from 'react-native-svg';
import { CircleHelp, Moon, Sun } from 'lucide-react-native';

const screenWidth = Dimensions.get('window').width;
const yAxisWidth = 56;
const chartContentWidth = Math.max(screenWidth - spacing.md * 2 - yAxisWidth - 2, 780);
const revenueChartStartPadding = 18;
const batchChartSize = 168;
const batchChartViewBoxSize = 200;
const batchChartScale = batchChartViewBoxSize / batchChartSize;

export default function DashboardScreen() {
  const { dashboardStats, paymentStats, payments, members, isLoadingData, fetchAppData, user } = useAppStore();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const [methodFilter, setMethodFilter] = React.useState('all');
  const [chartYear, setChartYear] = React.useState(new Date().getFullYear());
  const [selectedPoint, setSelectedPoint] = React.useState(null);
  const [selectedPointMeta, setSelectedPointMeta] = React.useState(null);
  const [showYearPicker, setShowYearPicker] = React.useState(false);

  const availableYears = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = new Set([currentYear, currentYear - 1]);
    (payments || []).forEach((p) => {
      const rawDate = p?.paidOn || p?.createdAt;
      if (rawDate) {
        const yr = new Date(rawDate).getFullYear();
        if (!Number.isNaN(yr)) years.add(yr);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [payments]);

  const activeLineColor = React.useMemo(() => {
    if (methodFilter === 'cash') {
      return colors.success;
    }
    if (methodFilter === 'upi') {
      return colors.secondary;
    }
    return colors.primary;
  }, [methodFilter, colors]);

  const chartConfigColor = React.useCallback((opacity = 1) => {
    try {
      const hex = activeLineColor;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    } catch (e) {
      return `rgba(139, 92, 246, ${opacity})`;
    }
  }, [activeLineColor]);

  const [statsRange, setStatsRange] = React.useState('today');
  const [animatedPoints, setAnimatedPoints] = React.useState(new Array(12).fill(0));
  const [animatedMonthRevenue, setAnimatedMonthRevenue] = React.useState(0);
  const chartScrollRef = React.useRef(null);
  const chartOpacity = React.useRef(new Animated.Value(0)).current;
  const chartTranslateY = React.useRef(new Animated.Value(12)).current;
  const chartScale = React.useRef(new Animated.Value(0.98)).current;
  const pulse = React.useRef(new Animated.Value(0)).current;
  const chartPointPositions = React.useRef([]);
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

  // ─── Interactive Svg Pie Chart helper methods ───
  const getCoordinatesForPercent = React.useCallback((percent) => {
    const x = Math.cos(2 * Math.PI * percent - Math.PI / 2);
    const y = Math.sin(2 * Math.PI * percent - Math.PI / 2);
    return [x, y];
  }, []);

  const getDonutSlicePath = React.useCallback((startPercent, endPercent, outerRadius = 78, innerRadius = 48, cx = 100, cy = 100) => {
    const [startX, startY] = getCoordinatesForPercent(startPercent);
    const [endX, endY] = getCoordinatesForPercent(endPercent);

    const outerStartX = cx + startX * outerRadius;
    const outerStartY = cy + startY * outerRadius;
    const outerEndX = cx + endX * outerRadius;
    const outerEndY = cy + endY * outerRadius;
    const innerEndX = cx + endX * innerRadius;
    const innerEndY = cy + endY * innerRadius;
    const innerStartX = cx + startX * innerRadius;
    const innerStartY = cy + startY * innerRadius;

    const largeArcFlag = endPercent - startPercent > 0.5 ? 1 : 0;

    return [
      `M ${outerStartX} ${outerStartY}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEndX} ${outerEndY}`,
      `L ${innerEndX} ${innerEndY}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStartX} ${innerStartY}`,
      'Z',
    ].join(' ');
  }, [getCoordinatesForPercent]);

  const [selectedSlice, setSelectedSlice] = React.useState(null);
  const chartPressScale = React.useRef(new Animated.Value(1)).current;

  const visibleMembers = React.useMemo(() => {
    return (members || []).filter((m) => m.status !== 'deleted');
  }, [members]);

  // ─── Locally computed member batch breakdown ────────────────────────────
  const batchStats = React.useMemo(() => {
    let morning = 0;
    let evening = 0;
    let other = 0;

    visibleMembers.forEach((m) => {
      const b = String(m.batch || '').trim().toLowerCase();
      if (b === 'morning') {
        morning++;
      } else if (b === 'evening') {
        evening++;
      } else {
        other++;
      }
    });

    return [
      {
        key: 'morning',
        name: 'Morning',
        population: morning,
        color: colors.primary,
        legendFontColor: colors.textSecondary,
        legendFontSize: 11,
      },
      {
        key: 'evening',
        name: 'Evening',
        population: evening,
        color: colors.secondary,
        legendFontColor: colors.textSecondary,
        legendFontSize: 11,
      },
      {
        key: 'other',
        name: 'Other/Unset',
        population: other,
        color: colors.textMuted,
        legendFontColor: colors.textSecondary,
        legendFontSize: 11,
      },
    ];
  }, [visibleMembers, colors]);

  const totalBatchMembers = React.useMemo(() => {
    return batchStats.reduce((sum, b) => sum + b.population, 0);
  }, [batchStats]);

  const defaultSelectedBatch = React.useMemo(() => {
    let maxPop = -1;
    let maxKey = 'morning';
    batchStats.forEach((b) => {
      if (b.population > maxPop) {
        maxPop = b.population;
        maxKey = b.key;
      }
    });
    return maxKey;
  }, [batchStats]);

  const activeSelectedSlice = React.useMemo(() => {
    const selectedBatchExists = batchStats.some((b) => b.key === selectedSlice && b.population > 0);
    return selectedBatchExists ? selectedSlice : defaultSelectedBatch;
  }, [batchStats, defaultSelectedBatch, selectedSlice]);

  const pieSlices = React.useMemo(() => {
    if (totalBatchMembers === 0) return [];

    let accumulatedPercent = 0;
    return batchStats.map((batch) => {
      const percent = batch.population / totalBatchMembers;
      const startPercent = accumulatedPercent;
      accumulatedPercent += percent;
      const endPercent = accumulatedPercent;

      return {
        key: batch.key,
        name: batch.name,
        population: batch.population,
        percent,
        startPercent,
        endPercent,
        color: batch.color,
      };
    });
  }, [batchStats, totalBatchMembers]);

  const selectBatch = React.useCallback((key) => {
    if (!key) return;
    setSelectedSlice(key);
    chartPressScale.stopAnimation();
    chartPressScale.setValue(0.97);
    Animated.spring(chartPressScale, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [chartPressScale]);

  const hasMemberData = React.useMemo(() => {
    return batchStats.some((b) => b.population > 0);
  }, [batchStats]);

  const selectedBatchData = React.useMemo(() => {
    return batchStats.find((b) => b.key === activeSelectedSlice) || batchStats[0];
  }, [activeSelectedSlice, batchStats]);

  const SelectedBatchIcon = activeSelectedSlice === 'morning'
    ? Sun
    : activeSelectedSlice === 'evening'
      ? Moon
      : CircleHelp;
  const selectedBatchTitle = activeSelectedSlice === 'morning'
    ? 'Morning Batch Details'
    : activeSelectedSlice === 'evening'
      ? 'Evening Batch Details'
      : 'Other / Unset Batch Details';
  const selectedBatchColor = selectedBatchData?.color || colors.primary;

  const handleDonutPress = React.useCallback((event) => {
    const availableSlices = pieSlices.filter((slice) => slice.population > 0);
    if (!availableSlices.length) return;

    const { locationX = batchChartSize / 2, locationY = batchChartSize / 2 } = event.nativeEvent || {};
    const chartX = locationX * batchChartScale;
    const chartY = locationY * batchChartScale;
    const dx = chartX - 100;
    const dy = chartY - 100;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 45) {
      const currentIndex = availableSlices.findIndex((slice) => slice.key === activeSelectedSlice);
      const nextSlice = availableSlices[(currentIndex + 1) % availableSlices.length];
      selectBatch(nextSlice.key);
      return;
    }

    if (distance > 96) return;

    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;
    const tappedPercent = angle / (Math.PI * 2);
    const tappedSlice = availableSlices.find((slice) => (
      tappedPercent >= slice.startPercent && tappedPercent <= slice.endPercent
    )) || availableSlices[availableSlices.length - 1];

    selectBatch(tappedSlice.key);
  }, [activeSelectedSlice, pieSlices, selectBatch]);

  const handleDonutPressIn = React.useCallback(() => {
    Animated.timing(chartPressScale, {
      toValue: 0.985,
      duration: 90,
      useNativeDriver: true,
    }).start();
  }, [chartPressScale]);

  const handleDonutPressOut = React.useCallback(() => {
    Animated.spring(chartPressScale, {
      toValue: 1,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [chartPressScale]);

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
    const monthlyStats = Array.from({ length: 12 }, () => ({
      revenue: 0,
      cashRevenue: 0,
      upiRevenue: 0,
      cashCount: 0,
      upiCount: 0,
      totalCount: 0,
    }));

    (payments || []).forEach((p) => {
      // Use createdAt as fallback when paidOn is absent
      const rawDate = p?.paidOn || p?.createdAt;
      const paidDate = rawDate ? new Date(rawDate) : null;
      if (!paidDate || Number.isNaN(paidDate.getTime()) || paidDate.getFullYear() !== chartYear) return;

      const amount = Number(p?.amount) || 0;
      const method = String(p?.paymentMethod || '').toLowerCase();
      const monthIdx = paidDate.getMonth();

      if (method === 'cash') {
        monthlyStats[monthIdx].cashRevenue += amount;
        monthlyStats[monthIdx].cashCount++;
      } else if (method === 'upi') {
        monthlyStats[monthIdx].upiRevenue += amount;
        monthlyStats[monthIdx].upiCount++;
      } else {
        monthlyStats[monthIdx].cashRevenue += amount;
        monthlyStats[monthIdx].cashCount++;
      }
      monthlyStats[monthIdx].totalCount++;

      if (methodFilter === 'all' || method === methodFilter) {
        monthlyStats[monthIdx].revenue += amount;
      }
    });

    return monthlyStats.map((stats, idx) => {
      const prevMonthStats = idx > 0 ? monthlyStats[idx - 1] : null;
      let momPercent = 0;
      if (prevMonthStats && prevMonthStats.revenue > 0) {
        momPercent = ((stats.revenue - prevMonthStats.revenue) / prevMonthStats.revenue) * 100;
      }

      return {
        month: monthNames[idx],
        revenue: stats.revenue,
        cashRevenue: stats.cashRevenue,
        upiRevenue: stats.upiRevenue,
        cashCount: stats.cashCount,
        upiCount: stats.upiCount,
        totalCount: stats.totalCount,
        momPercent,
      };
    });
  }, [payments, methodFilter, chartYear, monthNames]);

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

  const selectChartPoint = React.useCallback((index, coordinates) => {
    const point = chartData[index];
    if (!point || !coordinates) return;

    const selection = {
      value: point.revenue,
      month: point.month,
      x: coordinates.x,
      y: coordinates.y,
      index,
    };
    setSelectedPoint(selection);
    setSelectedPointMeta({ x: selection.x, y: selection.y });
  }, [chartData]);

  const selectNearestChartPoint = React.useCallback((locationX) => {
    if (!Number.isFinite(locationX)) return;

    const nearestPoint = chartPointPositions.current.reduce((nearest, point) => {
      if (!point) return nearest;
      if (!nearest || Math.abs(point.x - locationX) < Math.abs(nearest.x - locationX)) {
        return point;
      }
      return nearest;
    }, null);

    if (nearestPoint) {
      selectChartPoint(nearestPoint.index, nearestPoint);
    }
  }, [selectChartPoint]);

  const renderDot = React.useCallback(({ x, y, index }) => {
    chartPointPositions.current[index] = { x, y, index };
    const isSelected = selectedPoint?.index === index;

    return (
      <G key={`revenue-dot-${index}`} pointerEvents="none">
        {isSelected && (
          <Line
            x1={x}
            y1={16}
            x2={x}
            y2={180}
            stroke={activeLineColor}
            strokeWidth={1.5}
            strokeDasharray="4, 4"
            opacity={0.7}
          />
        )}
        <Circle
          cx={x}
          cy={y}
          r={isSelected ? 6 : 4}
          fill={isSelected ? colors.surface : activeLineColor}
          stroke={isSelected ? activeLineColor : colors.surface}
          strokeWidth={2}
        />
      </G>
    );
  }, [activeLineColor, colors.surface, selectedPoint?.index]);

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

  const activeMonthIndex = selectedPoint !== null ? selectedPoint.index : new Date().getMonth();
  const activeMonthData = chartData[activeMonthIndex] || chartData[new Date().getMonth()] || chartData[0];

  return (
    <AppBackground>
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

      <View style={styles.chartHeaderRow}>
        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Monthly Revenue</Text>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setShowYearPicker(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.dropdownButtonText}>{chartYear}</Text>
          <Text style={styles.dropdownButtonArrow}>▼</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showYearPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowYearPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowYearPicker(false)}
        >
          <View style={styles.dropdownMenu}>
            <Text style={styles.dropdownMenuTitle}>Select Year</Text>
            {availableYears.map((yr) => (
              <TouchableOpacity
                key={yr}
                style={[
                  styles.dropdownMenuItem,
                  chartYear === yr && styles.dropdownMenuItemActive,
                ]}
                onPress={() => {
                  setChartYear(yr);
                  setSelectedPoint(null);
                  setSelectedPointMeta(null);
                  setShowYearPicker(false);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dropdownMenuItemText,
                    chartYear === yr && styles.dropdownMenuItemTextActive,
                  ]}
                >
                  {yr}
                </Text>
                {chartYear === yr && (
                  <Text style={styles.dropdownMenuItemCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

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
            <View style={styles.chartPlotWrapper}>
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
                  color: chartConfigColor,
                  labelColor: () => colors.textSecondary,
                  style: { borderRadius: radius.card },
                  propsForBackgroundLines: { stroke: colors.border },
                }}
                bezier
                style={{ borderRadius: radius.card, paddingRight: revenueChartStartPadding }}
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
                      backgroundColor: activeLineColor,
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
              <Pressable
                style={styles.chartTouchLayer}
                accessibilityRole="button"
                accessibilityLabel="Monthly revenue chart. Tap near a month to inspect its revenue."
                onPress={(event) => selectNearestChartPoint(event.nativeEvent.locationX)}
              />
            </View>
          </ScrollView>
        </View>
      </Animated.View>

      <View style={styles.revenueInsightCard}>
        <View style={styles.insightHeaderRow}>
          <Text style={styles.insightTitle}>📈 {activeMonthData.month} Revenue Insights</Text>
          {Math.abs(activeMonthData.momPercent) >= 0.05 && (
            <View style={[
              styles.trendBadge,
              { backgroundColor: activeMonthData.momPercent > 0 ? `${colors.success}15` : `${colors.danger}15` }
            ]}>
              <Text style={[
                styles.trendText,
                { color: activeMonthData.momPercent > 0 ? colors.success : colors.danger }
              ]}>
                {activeMonthData.momPercent > 0 ? '▲' : '▼'} {Math.abs(activeMonthData.momPercent).toFixed(1)}% MoM
              </Text>
            </View>
          )}
        </View>

        <View style={styles.insightStatsRow}>
          <View style={styles.insightStat}>
            <Text style={styles.insightStatLabel}>
              {methodFilter === 'cash' ? 'Cash Revenue' : methodFilter === 'upi' ? 'UPI Revenue' : 'Total Revenue'}
            </Text>
            <Text style={styles.insightStatValue}>Rs {activeMonthData.revenue.toLocaleString()}</Text>
          </View>
          <View style={styles.insightStatDivider} />
          <View style={styles.insightStat}>
            <Text style={styles.insightStatLabel}>Transactions</Text>
            <Text style={styles.insightStatValue}>
              {methodFilter === 'cash' 
                ? `${activeMonthData.cashCount} payments` 
                : methodFilter === 'upi' 
                  ? `${activeMonthData.upiCount} payments` 
                  : `${activeMonthData.totalCount} payments`}
            </Text>
          </View>
        </View>

        <View style={styles.insightDetailRow}>
          <View style={styles.insightDetailCol}>
            <View style={[styles.methodDot, { backgroundColor: colors.success }]} />
            <Text style={styles.insightDetailText}>
              Cash: <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Rs {activeMonthData.cashRevenue.toLocaleString()}</Text> ({activeMonthData.cashCount} txs)
            </Text>
          </View>
          <View style={styles.insightDetailCol}>
            <View style={[styles.methodDot, { backgroundColor: colors.secondary }]} />
            <Text style={styles.insightDetailText}>
              UPI: <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Rs {activeMonthData.upiRevenue.toLocaleString()}</Text> ({activeMonthData.upiCount} txs)
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.pieContainer}>
        <Text style={styles.sectionTitle}>Members by Batch</Text>
        {hasMemberData ? (
          <View>
            <View style={styles.pieLayoutRow}>
              {/* Interactive Svg Pie Chart */}
              <View style={styles.pieChartWrapper}>
                <Pressable
                  onPress={handleDonutPress}
                  onPressIn={handleDonutPressIn}
                  onPressOut={handleDonutPressOut}
                  style={styles.piePressable}
                >
                  <Animated.View style={{ transform: [{ scale: chartPressScale }] }}>
                    <Svg width={batchChartSize} height={batchChartSize} viewBox="0 0 200 200" pointerEvents="none">
                      <G transform="translate(0, 0)">
                        {pieSlices.map((slice) => {
                          const isSelected = activeSelectedSlice === slice.key;
                          const outerRadius = isSelected ? 82 : 76;
                          const innerRadius = 48;
                          const strokeWidth = isSelected ? 3 : 1.5;

                          if (slice.percent >= 0.999) {
                            return (
                              <Circle
                                key={slice.key}
                                cx={100}
                                cy={100}
                                r={(outerRadius + innerRadius) / 2}
                                fill="none"
                                stroke={slice.color}
                                strokeWidth={outerRadius - innerRadius}
                                strokeLinecap="round"
                              />
                            );
                          }

                          if (slice.percent === 0) return null;

                          const pathData = getDonutSlicePath(slice.startPercent, slice.endPercent, outerRadius, innerRadius, 100, 100);

                          return (
                            <Path
                              key={slice.key}
                              d={pathData}
                              fill={slice.color}
                              fillOpacity={isSelected ? 1 : 0.62}
                              stroke={colors.surface}
                              strokeWidth={strokeWidth}
                            />
                          );
                        })}
                        <Circle cx={100} cy={100} r={34} fill={colors.surface} stroke={colors.border} strokeWidth={1} />
                        <SvgText
                          x={100}
                          y={96}
                          textAnchor="middle"
                          fontSize={23}
                          fontWeight="800"
                          fill={colors.textPrimary}
                        >
                          {selectedBatchData?.population || 0}
                        </SvgText>
                        <SvgText
                          x={100}
                          y={116}
                          textAnchor="middle"
                          fontSize={11}
                          fontWeight="700"
                          fill={colors.textSecondary}
                        >
                          members
                        </SvgText>
                      </G>
                    </Svg>
                  </Animated.View>
                </Pressable>
              </View>

              {/* Legend column */}
              <View style={styles.pieDetailsColumn}>
                {batchStats.map((b) => {
                  const key = b.key;
                  const isSelected = activeSelectedSlice === key;
                  const percent = totalBatchMembers > 0
                    ? Math.round((b.population / totalBatchMembers) * 100)
                    : 0;
                  return (
                    <TouchableOpacity
                      key={b.name}
                      style={[styles.legendItem, isSelected && styles.legendItemActive]}
                      onPress={() => selectBatch(key)}
                      activeOpacity={0.65}
                    >
                      <View style={[styles.legendColorBox, { backgroundColor: b.color }]} />
                      <View style={{ flex: 1 }}>
                        <View style={styles.legendTopRow}>
                          <Text style={[styles.legendName, isSelected && styles.legendNameActive]}>
                            {b.name}
                          </Text>
                          <Text style={[styles.legendPercent, isSelected && { color: colors.textPrimary }]}>
                            {percent}%
                          </Text>
                        </View>
                        <View style={styles.legendProgressTrack}>
                          <View
                            style={[
                              styles.legendProgressFill,
                              {
                                width: `${percent}%`,
                                backgroundColor: b.color,
                                opacity: isSelected ? 1 : 0.45,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.legendPopulation}>{b.population} members</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Selected batch summary details */}
            <View style={styles.selectedBatchCard}>
              <View style={styles.selectedBatchHeader}>
                <View style={[styles.selectedBatchIconBox, { backgroundColor: `${selectedBatchColor}18` }]}>
                  <SelectedBatchIcon size={16} color={selectedBatchColor} strokeWidth={2.4} />
                </View>
                <Text style={styles.selectedBatchHeaderTitle}>{selectedBatchTitle}</Text>
              </View>
              <Text style={styles.selectedBatchTitleHidden}>
                {activeSelectedSlice === 'morning' ? '🌅 Morning Batch Details' : 
                 activeSelectedSlice === 'evening' ? '🌇 Evening Batch Details' : 
                 '❓ Other / Unset Batch Details'}
              </Text>
              <Text style={styles.selectedBatchDescription}>
                {activeSelectedSlice === 'morning' 
                  ? `Morning batch has ${batchStats[0].population} active members. Peak attendance is usually between 6:00 AM and 9:00 AM.`
                  : activeSelectedSlice === 'evening'
                  ? `Evening batch has ${batchStats[1].population} active members. Peak attendance is usually between 5:00 PM and 8:30 PM.`
                  : `There are ${batchStats[2].population} members without an explicitly assigned batch.`
                }
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No member data available</Text>
          </View>
        )}
      </View>

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
    </AppBackground>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
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
    fontSize: 25,
    fontWeight: '800',
  
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
    marginBottom: spacing.sm,
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
  chartTouchLayer: {
    ...StyleSheet.absoluteFillObject,
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
  pieContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  pieLayoutRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: spacing.sm,
  },
  pieChartWrapper: {
    width: batchChartSize,
    height: batchChartSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  piePressable: {
    width: batchChartSize,
    height: batchChartSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: batchChartSize / 2,
  },
  pieDetailsColumn: {
    flex: 1,
    minWidth: 136,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  legendItemActive: {
    backgroundColor: colors.background === '#141A22' ? '#222934' : '#F2ECE1',
    borderColor: colors.border,
    boxShadow: colors.background === '#141A22'
      ? '0 8px 20px rgba(0, 0, 0, 0.18)'
      : '0 8px 20px rgba(31, 60, 52, 0.08)',
  },
  legendColorBox: {
    width: 12,
    height: 12,
    borderRadius: 4,
    marginRight: 10,
  },
  legendTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minWidth: 0,
  },
  legendName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    flexShrink: 1,
  },
  legendNameActive: {
    color: colors.textPrimary,
  },
  legendPercent: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
  legendProgressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.background === '#141A22' ? '#303746' : '#E8DED2',
    overflow: 'hidden',
    marginTop: 6,
  },
  legendProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  legendPopulation: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  selectedBatchCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedBatchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  selectedBatchIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBatchHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  selectedBatchTitleHidden: {
    display: 'none',
  },
  selectedBatchDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dropdownButtonText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
  },
  dropdownButtonArrow: {
    color: colors.accent,
    fontSize: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    width: '75%',
    maxWidth: 260,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
  },
  dropdownMenuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  dropdownMenuItemActive: {
    backgroundColor: `${colors.accent}15`,
  },
  dropdownMenuItemText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  dropdownMenuItemTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  dropdownMenuItemCheck: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  revenueInsightCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    minHeight: 134,
    justifyContent: 'space-between',
    ...shadows.sm,
  },
  insightHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  insightTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  trendBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '800',
  },
  insightStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  insightStat: {
    flex: 1,
    alignItems: 'center',
  },
  insightStatLabel: {
    fontSize: 9,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  insightStatValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  insightStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  insightDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  insightDetailCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  insightDetailText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  emptyContainer: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
  },
});
