import { useTheme } from '@/contexts/theme-context';
import { COLORS } from '@/constants/theme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof COLORS
) {
  const { theme } = useTheme();

  // Return context color tokens first, then fall back safely to hardcoded constants
  return theme?.colors?.[colorName] || COLORS[colorName] || '#000000';
}