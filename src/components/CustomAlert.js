import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, typography, shadows } from '../theme/theme';
import { useThemeColors } from '../theme/palette';

/**
 * Standard configuration mapping for each alert type, specifying its default icon and color palette key.
 */
const TYPE_CONFIGS = {
  success: {
    defaultIcon: 'checkmark-circle-outline',
    colorKey: 'success',
  },
  error: {
    defaultIcon: 'close-circle-outline',
    colorKey: 'danger',
  },
  warning: {
    defaultIcon: 'warning-outline',
    colorKey: 'warning',
  },
  info: {
    defaultIcon: 'information-circle-outline',
    colorKey: 'primary',
  },
  action: {
    defaultIcon: 'options-outline',
    colorKey: 'primary',
  },
  delete: {
    defaultIcon: 'trash-outline',
    colorKey: 'danger',
  },
  download: {
    defaultIcon: 'download-outline',
    colorKey: 'primary',
  },
  password: {
    defaultIcon: 'lock-closed-outline',
    colorKey: 'primary',
  },
  sms: {
    defaultIcon: 'chatbubble-ellipses-outline',
    colorKey: 'primary',
  },
};

/**
 * A highly customizable, beautiful, and accessible Custom Alert component for React Native.
 * Supports standard alert types (success, error, warning, info) and lists of options (action sheets).
 * Allows custom icons passed directly via the `icon` prop.
 */
const CustomAlert = ({
  visible = false,
  title,
  message,
  buttons = [],
  type = 'info',
  icon,
  onClose,
}) => {
  const colors = useThemeColors();
  
  // Memoize style sheet creation to prevent unnecessary recalculations
  const styles = useMemo(() => getStyles(colors), [colors]);

  // Resolve standard colors and fallback icons
  const iconInfo = useMemo(() => {
    const config = TYPE_CONFIGS[type] || TYPE_CONFIGS.info;
    const color = colors[config.colorKey] || colors.primary;

    return {
      iconName: typeof icon === 'string' ? icon : config.defaultIcon,
      iconColor: color,
      iconBg: `${color}15`, // Soft background tint (15% opacity hex)
    };
  }, [type, icon, colors]);

  if (!visible) return null;

  const handlePress = (onPress) => {
    if (onPress) onPress();
    if (onClose) onClose();
  };

  const renderIcon = () => {
    // If the icon parameter is a valid React element, render it directly
    if (React.isValidElement(icon)) {
      return icon;
    }
    // If the icon parameter is a React Component class/function, render it
    if (typeof icon === 'function') {
      const IconComponent = icon;
      return <IconComponent size={32} color={iconInfo.iconColor} />;
    }
    // Otherwise, render the resolved Ionicons string icon name
    return <Ionicons name={iconInfo.iconName} size={32} color={iconInfo.iconColor} />;
  };

  const renderActionButton = (btn, index) => {
    const isCancel = btn.style === 'cancel';
    const isDestructive = btn.style === 'destructive';

    return (
      <TouchableOpacity
        key={index}
        style={[styles.actionListBtn, isCancel && styles.actionListBtnCancel]}
        onPress={() => handlePress(btn.onPress)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.actionListText,
            isCancel && styles.actionListTextCancel,
            isDestructive && styles.actionListTextDestructive,
          ]}
        >
          {btn.text}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderStandardButton = (btn, index) => {
    const isCancel = btn.style === 'cancel';
    const isDestructive = btn.style === 'destructive';

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.btn,
          isCancel
            ? styles.cancelBtn
            : isDestructive
            ? styles.dangerBtn
            : styles.primaryBtn,
        ]}
        onPress={() => handlePress(btn.onPress)}
        activeOpacity={0.7}
      >
        <Text style={[styles.btnText, isCancel ? styles.cancelText : styles.primaryText]}>
          {btn.text}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header Icon */}
          <View style={[styles.iconContainer, { backgroundColor: iconInfo.iconBg }]}>
            {renderIcon()}
          </View>

          {/* Alert Title */}
          {title ? <Text style={styles.title}>{title}</Text> : null}

          {/* Alert Message */}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {/* Buttons/Actions Container */}
          <View style={type === 'action' ? styles.actionList : styles.actions}>
            {buttons.map((btn, index) => 
              type === 'action' 
                ? renderActionButton(btn, index) 
                : renderStandardButton(btn, index)
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (colors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      padding: spacing.xl,
      width: '100%',
      maxWidth: 340,
      alignItems: 'center',
      ...shadows.md,
    },
    iconContainer: {
      width: 64,
      height: 64,
      borderRadius: radius.full,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    title: {
      ...typography.heading,
      fontSize: typography.sizes.lg,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    message: {
      ...typography.body,
      fontSize: typography.sizes.md,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.xl,
      lineHeight: 22,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.md,
      width: '100%',
    },
    btn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: radius.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cancelBtn: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      ...shadows.sm,
    },
    dangerBtn: {
      backgroundColor: colors.danger,
      ...shadows.sm,
    },
    btnText: {
      ...typography.body,
      fontWeight: '700',
    },
    cancelText: {
      color: colors.textSecondary,
      fontWeight: '600',
    },
    primaryText: {
      color: '#FFF',
    },
    actionList: {
      width: '100%',
      gap: spacing.sm,
    },
    actionListBtn: {
      width: '100%',
      paddingVertical: 14,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
    },
    actionListBtnCancel: {
      backgroundColor: colors.background,
      marginTop: spacing.sm,
    },
    actionListText: {
      ...typography.body,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    actionListTextCancel: {
      color: colors.textSecondary,
    },
    actionListTextDestructive: {
      color: colors.danger,
    },
  });

export default React.memo(CustomAlert);
