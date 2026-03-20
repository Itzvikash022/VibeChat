// This file is used on Web to avoid importing native-only Expo modules
// which can cause initialization crashes (e.g. Uncaught TypeError).

export const Notifications = {
  setNotificationHandler: () => {},
  addNotificationReceivedListener: () => ({ remove: () => {} }),
  addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
  getPermissionsAsync: async () => ({ status: 'denied' }),
  requestPermissionsAsync: async () => ({ status: 'denied' }),
  getExpoPushTokenAsync: async () => ({ data: '' }),
  setNotificationChannelAsync: async () => {},
  AndroidImportance: {},
};

export const Device = {
  isDevice: false,
};

export const Constants = {
  expoConfig: { extra: { eas: { projectId: '' } } },
};
