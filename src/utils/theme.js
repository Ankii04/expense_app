export const COLORS = {
  background: '#0A0A0F',
  card: '#13131A',
  elevated: '#1C1C26',
  accent: '#7C6AFF',
  accentDim: 'rgba(124, 106, 255, 0.15)',
  accentGlow: 'rgba(124, 106, 255, 0.3)',
  green: '#22D07A',
  greenDim: 'rgba(34, 208, 122, 0.15)',
  red: '#FF4D6A',
  redDim: 'rgba(255, 77, 106, 0.15)',
  amber: '#FFB547',
  amberDim: 'rgba(255, 181, 71, 0.15)',
  orange: '#E05D2A',
  textPrimary: '#F0F0FF',
  textSecondary: '#8888AA',
  textMuted: '#4A4A6A',
  border: 'rgba(255, 255, 255, 0.06)',
  borderLight: 'rgba(255, 255, 255, 0.1)',
  glass: 'rgba(19, 19, 26, 0.85)',
  overlay: 'rgba(0, 0, 0, 0.6)',
  white: '#FFFFFF',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const FONT_SIZE = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 28,
  hero: 36,
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const CATEGORIES = [
  { id: 'food', name: 'Food', emoji: '🍔', color: '#FF6B6B' },
  { id: 'transport', name: 'Transport', emoji: '🚗', color: '#4ECDC4' },
  { id: 'shopping', name: 'Shopping', emoji: '🛍️', color: '#A78BFA' },
  { id: 'bills', name: 'Bills', emoji: '⚡', color: '#FFB547' },
  { id: 'health', name: 'Health', emoji: '💊', color: '#22D07A' },
  { id: 'entertainment', name: 'Entertainment', emoji: '🎬', color: '#FF4D6A' },
  { id: 'education', name: 'Education', emoji: '📚', color: '#60A5FA' },
  { id: 'groceries', name: 'Groceries', emoji: '🛒', color: '#34D399' },
  { id: 'rent', name: 'Rent', emoji: '🏠', color: '#F472B6' },
  { id: 'betting', name: 'Betting', emoji: '🎲', color: '#FBBF24' },
  { id: 'exchange', name: 'Exchange', emoji: '💱', color: '#818CF8' },
  { id: 'other', name: 'Other', emoji: '💸', color: '#8888AA' },
];

export const UPI_APPS = [
  { id: 'gpay', name: 'Google Pay', shortName: 'GPay', emoji: '🟢', scheme: 'tez://upi/pay' },
  { id: 'phonepe', name: 'PhonePe', shortName: 'PhonePe', emoji: '🟣', scheme: 'phonepe://pay' },
  { id: 'paytm', name: 'Paytm', shortName: 'Paytm', emoji: '🔵', scheme: 'paytmmp://pay' },
  { id: 'bhim', name: 'BHIM', shortName: 'BHIM', emoji: '🟠', scheme: 'bhim://pay' },
  { id: 'cred', name: 'CRED', shortName: 'CRED', emoji: '⚫', scheme: 'credpay://upi/pay' },
  { id: 'amazonpay', name: 'Amazon Pay', shortName: 'Amazon', emoji: '🟡', scheme: 'amazonpay://pay' },
];

export const getCategoryById = (id) => {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
};

export const formatCurrency = (amount) => {
  const num = Number(amount) || 0;
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

// Safe version for HTML injection (avoids WebView rendering issues)
export const formatCurrencyHTML = (amount) => {
  const num = Number(amount) || 0;
  return 'Rs.' + num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

export const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;

  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

export const getMonthKey = (date) => {
  const d = date ? new Date(date) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// Escape string for safe HTML injection
export const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};
