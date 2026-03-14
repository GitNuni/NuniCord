/**
 * Native push notifications for iOS (Capacitor)
 * Falls back gracefully when running in browser
 */

function isNative() {
  return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform();
}

export async function registerNativePush(apiClient) {
  if (!isNative()) return;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Request permission
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return;

    // Register with APNs
    await PushNotifications.register();

    // On registration success, send token to server
    PushNotifications.addListener('registration', async (token) => {
      try {
        await apiClient.post('/notifications/device-token', {
          token: token.value,
          platform: 'ios',
        });
      } catch (e) {
        console.warn('Failed to register device token:', e);
      }
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration error:', err);
    });

    // Handle notification received while app is open
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received in foreground:', notification);
    });

    // Handle tap on notification
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action.notification.data;
      if (data?.channel_id) {
        window.location.hash = `/channels/${data.server_id}/channels/${data.channel_id}`;
      }
    });
  } catch (e) {
    console.warn('Native push setup failed:', e);
  }
}
