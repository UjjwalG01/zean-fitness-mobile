// 📂 File: constants/theme.ts
import { Platform } from 'react-native';

export const COLORS = {
  primary: '#FF6B35',
  accent: '#FF6B35',
  background: '#0F172A',
  card: '#1E293B',
  cardAlt: '#263448',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  border: '#334155',
  white: '#FFFFFF',
  codeBg: '#0B0F19',
};

export const DIMENSIONS = {
  TAB_MENU_HEIGHT: Platform.OS === 'web' ? 56 : 49,
  SCROLL_EXTRA_PADDING: 16,
  WEB_TAB_MENU_PADDING: 90,
};

// ✨ ADD THIS NEW FONTS OBJECT TO FIX THE TYPOGRAPHY ERRORS:
export const Fonts = {
  rounded: Platform.OS === 'ios' ? 'System' : 'sans-serif-rounded',
  mono: Platform.OS === 'ios' ? 'Courier' : 'monospace',
};