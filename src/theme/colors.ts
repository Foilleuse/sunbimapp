export const colors = {
  primary: '#87CEEB',
  secondary: '#4A90E2',
  background: '#F0F8FF',
  white: '#FFFFFF',
  black: '#000000',
  gray: {
    light: '#E5E5E5',
    medium: '#9E9E9E',
    dark: '#424242',
  },
  drawing: {
    black: '#000000',
    red: '#E74C3C',
    blue: '#3498DB',
    green: '#2ECC71',
    yellow: '#F1C40F',
  },
  ui: {
    success: '#27AE60',
    error: '#E74C3C',
    warning: '#F39C12',
    info: '#3498DB',
  },
};

export type DrawingColor = keyof typeof colors.drawing;
