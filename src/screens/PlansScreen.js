import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import Button from '../components/Button';
import CustomAlert from '../components/CustomAlert';
import { radius, spacing, typography } from '../theme/theme';
import { useThemeColors } from '../theme/palette';

export default function PlansScreen() {
  const { plans, addPlan, updatePlan, deletePlan, isLoadingData, fetchAppData } = useAppStore();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', durationMonths: '', amount: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [alertConfig, setAlertConfig] = useState({ visible: false });

  const showAlert = (title, message, buttons = [{ text: 'OK' }], type = 'info') => {
    setAlertConfig({ visible: true, title, message, buttons, type });
  };

  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: '', durationMonths: '', amount: '' });
    setError('');
  };

  const handleEdit = (plan) => {
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      durationMonths: plan.durationMonths ? plan.durationMonths.toString() : '',
      amount: plan.amount ? plan.amount.toString() : ''
    });
    setError('');
  };

  const handleDelete = (plan) => {
    showAlert('Delete Plan', `Are you sure you want to delete ${plan.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deletePlan(plan.id);
          setTimeout(() => showAlert('Success', 'Plan deleted successfully!', [{ text: 'OK' }], 'success'), 320);
        } catch (err) {
          showAlert('Error', err.message, [{ text: 'OK' }], 'error');
        }
      }}
    ], 'delete');
  };

  const handleSave = async () => {
    if (!form.name || !form.durationMonths || !form.amount) {
      showAlert('Error', 'Please fill in all fields.', [{ text: 'OK' }], 'error');
      return;
    }

    // Ensure the Plan Name contains at least one alphabetic character
    if (!/[a-zA-Z]/.test(form.name)) {
      showAlert('Error', 'Plan Name must contain at least one letter.', [{ text: 'OK' }], 'error');
      return;
    }

    setLoading(true);

    const payload = {
      name: form.name,
      durationMonths: parseInt(form.durationMonths, 10),
      amount: parseFloat(form.amount)
    };

    try {
      if (editingId) {
        await updatePlan(editingId, payload);
      } else {
        await addPlan(payload);
      }
      resetForm();
      setTimeout(() => showAlert('Success', `Plan successfully ${editingId ? 'updated' : 'added'}!`, [{ text: 'OK' }], 'success'), 320);
    } catch (err) {
      showAlert('Error', err.message || 'Failed to save plan', [{ text: 'OK' }], 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={fetchAppData} tintColor={colors.accent} />}
    >
      
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>{editingId ? 'Edit Plan' : 'Create New Plan'}</Text>
          {editingId && (
            <TouchableOpacity onPress={resetForm}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.label}>Plan Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Annual Pro"
          value={form.name}
          onChangeText={(val) => setForm(f => ({ ...f, name: val }))}
          placeholderTextColor={colors.textMuted}
        />

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <Text style={styles.label}>Duration (Months)</Text>
            <TextInput
              style={styles.input}
              placeholder="12"
              keyboardType="numeric"
              value={form.durationMonths}
              onChangeText={(val) => setForm(f => ({ ...f, durationMonths: val }))}
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={styles.label}>Amount (₹)</Text>
            <TextInput
              style={styles.input}
              placeholder="1000"
              keyboardType="numeric"
              value={form.amount}
              onChangeText={(val) => setForm(f => ({ ...f, amount: val }))}
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        <Button 
          title={editingId ? "Update Plan" : "Save Plan"} 
          onPress={handleSave} 
          loading={loading}
          style={styles.saveBtn}
        />
      </View>

      <Text style={[styles.sectionTitle, { marginLeft: spacing.xs, marginBottom: spacing.sm }]}>Existing Plans</Text>
      
      {plans.length === 0 ? (
        <Text style={styles.emptyText}>No plans found. Create one above.</Text>
      ) : (
        plans.map(plan => (
          <View key={plan.id} style={styles.planCard}>
            <View style={styles.planInfo}>
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planDetails}>{plan.durationMonths} Months  •  ₹{plan.amount}</Text>
            </View>
            <View style={styles.planActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleEdit(plan)}>
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(plan)}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <CustomAlert 
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        type={alertConfig.type}
        onClose={hideAlert}
      />

    </ScrollView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.card,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.heading,
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
  },
  cancelText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  label: {
    ...typography.body,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 48,
    marginBottom: spacing.md,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
  },
  saveBtn: {
    marginTop: spacing.xs,
  },
  errorText: {
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  planCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.card,
    marginBottom: spacing.sm,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    ...typography.heading,
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  planDetails: {
    ...typography.body,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  planActions: {
    flexDirection: 'row',
  },
  actionBtn: {
    marginLeft: spacing.md,
    padding: spacing.xs,
  },
  editText: {
    color: colors.accent,
    fontWeight: '600',
  },
  deleteText: {
    color: colors.danger,
    fontWeight: '600',
  },
  loadingInline: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
});
