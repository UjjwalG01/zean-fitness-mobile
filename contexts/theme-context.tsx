import React, { createContext, useContext, useMemo, ReactNode } from "react";
import { COLORS } from "@/constants/theme";

interface ThemeContextType {
  theme: {
    colors: typeof COLORS;
  };
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: { colors: COLORS },
});

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const theme = useMemo(() => ({ colors: COLORS }), []);
  const value = useMemo(() => ({ theme }), [theme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
