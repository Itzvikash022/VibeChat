import React, { createContext, useContext, useState } from 'react';

// ─── Color Palettes ────────────────────────────────────────────────────────────
export const DARK = {
  // Material 3 UI design palette extracted from HTML mockups
  "primary-fixed-dim": "#c0c1ff",
  "outline-variant": "#464555",
  "surface-container-high": "#222a3d",
  "primary-container": "#5d60eb",
  "surface-container-low": "#131b2e",
  "on-background": "#dae2fd",
  "surface-tint": "#c0c1ff",
  "inverse-primary": "#494bd6",
  "on-primary-fixed": "#07006c",
  "primary": "#c0c1ff",
  "surface-dim": "#0b1326",
  "tertiary": "#fbabff",
  "on-tertiary-container": "#fff5fa",
  "error": "#ffb4ab",
  "tertiary-fixed-dim": "#fbabff",
  "surface-container": "#171f33",
  "secondary-fixed-dim": "#d0bcff",
  "on-secondary-container": "#c4abff",
  "background": "#0b1326",
  "on-primary-fixed-variant": "#2f2ebe",
  "tertiary-fixed": "#ffd6fd",
  "surface-container-highest": "#2d3449",
  "on-tertiary-fixed-variant": "#7c008e",
  "on-tertiary-fixed": "#36003e",
  "tertiary-container": "#bc24d4",
  "error-container": "#93000a",
  "on-secondary": "#3c0091",
  "on-surface-variant": "#c7c4d7",
  "secondary-container": "#571bc1",
  "surface-container-lowest": "#060e20",
  "secondary": "#d0bcff",
  "on-surface": "#dae2fd",
  "secondary-fixed": "#e9ddff",
  "surface": "#0b1326",
  "inverse-on-surface": "#283044",
  "surface-variant": "#2d3449",
  "on-error-container": "#ffdad6",
  "on-primary-container": "#faf7ff",
  "surface-bright": "#31394d",
  "on-error": "#690005",
  "outline": "#908fa0",
  "on-secondary-fixed": "#23005c",
  "primary-fixed": "#e1e0ff",
  "on-tertiary": "#580065",
  "on-primary": "#1000a9",
  "inverse-surface": "#dae2fd",
  "on-secondary-fixed-variant": "#5516be",
  
  // Backwards compatibility mappings for older components
  bg: '#0b1326', // background
  sidebar: '#2d3449', // surface-variant
  sidebarBorder: '#464555', // outline-variant
  card: '#131b2e', // surface-container-low
  text: '#dae2fd', // on-surface
  textSecondary: '#c7c4d7', // on-surface-variant
  input: '#060e20', // surface-container-lowest
  inputBorder: '#464555', // outline-variant
  myBubble: '#5d60eb', // primary-container
  theirBubble: '#222a3d', // surface-container-high
  theirBubbleBorder: '#464555', // outline-variant
  accent: '#c0c1ff', // primary
  activeItem: '#131b2e', // surface-container-low
  unreadBadge: '#c0c1ff', // primary
  headerBg: '#0b1326', // background
  divider: '#464555', // outline-variant
  sendBtn: '#5d60eb', // primary-container
  avatarBg: '#5d60eb', // primary-container
};

export const LIGHT = {
  // We keep the legacy light mode intact as requested (no new M3 light theme provided)
  bg: '#f6f8fa',
  sidebar: '#ffffff',
  sidebarBorder: '#d0d7de',
  card: '#ffffff',
  text: '#1f2328',
  textSecondary: '#656d76',
  input: '#ffffff',
  inputBorder: '#d0d7de',
  myBubble: '#0969da',
  theirBubble: '#ffffff',
  theirBubbleBorder: '#d0d7de',
  accent: '#0969da',
  activeItem: '#ddf4ff',
  unreadBadge: '#0969da',
  headerBg: '#ffffff',
  divider: '#d0d7de',
  sendBtn: '#0969da',
  avatarBg: '#0969da',
  // Fallbacks for new keys applied to light mode if toggled
  "primary-fixed-dim": "#c0c1ff",
  "outline-variant": "#d0d7de",
  "surface-container-high": "#ffffff",
  "primary-container": "#0969da",
  "surface-container-low": "#ffffff",
  "on-background": "#1f2328",
  "surface-tint": "#0969da",
  "inverse-primary": "#0969da",
  "on-primary-fixed": "#ffffff",
  "primary": "#0969da",
  "surface-dim": "#f6f8fa",
  "tertiary": "#fbabff",
  "on-tertiary-container": "#fff5fa",
  "error": "#ffb4ab",
  "tertiary-fixed-dim": "#fbabff",
  "surface-container": "#ffffff",
  "secondary-fixed-dim": "#d0bcff",
  "on-secondary-container": "#c4abff",
  "background": "#f6f8fa",
  "on-primary-fixed-variant": "#0969da",
  "tertiary-fixed": "#ffd6fd",
  "surface-container-highest": "#f6f8fa",
  "on-tertiary-fixed-variant": "#7c008e",
  "on-tertiary-fixed": "#36003e",
  "tertiary-container": "#bc24d4",
  "error-container": "#93000a",
  "on-secondary": "#1f2328",
  "on-surface-variant": "#656d76",
  "secondary-container": "#571bc1",
  "surface-container-lowest": "#ffffff",
  "secondary": "#d0bcff",
  "on-surface": "#1f2328",
  "secondary-fixed": "#e9ddff",
  "surface": "#f6f8fa",
  "inverse-on-surface": "#f6f8fa",
  "surface-variant": "#ffffff",
  "on-error-container": "#ffdad6",
  "on-primary-container": "#ffffff",
  "surface-bright": "#ffffff",
  "on-error": "#690005",
  "outline": "#d0d7de",
  "on-secondary-fixed": "#23005c",
  "primary-fixed": "#0969da",
  "on-tertiary": "#580065",
  "on-primary": "#ffffff",
  "inverse-surface": "#f6f8fa",
  "on-secondary-fixed-variant": "#5516be"
};

// ─── Context ───────────────────────────────────────────────────────────────────
const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(true);
  const theme = isDark ? DARK : LIGHT;
  const toggleTheme = () => setIsDark((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
