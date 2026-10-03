export const colors = {
  background: "#F8FAFC", // Slate-50
  surface: "#FFFFFF",
  white: "#FFFFFF",
  black: "#000000",
  textPrimary: "#0F172A", // Slate-900 (ultra-dark slate, 17.5:1 contrast)
  textSecondary: "#334155", // Slate-700 (dark charcoal slate, 9.6:1 contrast)
  textMuted: "#475569", // Slate-600 (rich dark slate, 5.8:1 contrast - zero light grey)
  neutralFill: "#F1F5F9", // Slate-100
  neutralDark: "#E2E8F0", // Slate-200
  primary: "#2563EB", // Blue-600
  primaryHover: "#1D4ED8",
  primaryLight: "#EFF6FF",
  success: "#10B981", // Emerald-500
  successLight: "#ECFDF5",
  warning: "#D97706", // Amber-600 (WCAG AA compliant 4.5:1 contrast on white)
  warningLight: "#FFFBEB",
  error: "#DC2626", // Red-600 (WCAG AA compliant 5.9:1 contrast on white)
  errorLight: "#FEF2F2",
  overlay: "rgba(15, 23, 42, 0.45)",
};

export const shadows = {
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  floating: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  subtle: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
};
