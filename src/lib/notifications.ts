import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { getDueSoonEvents } from '@/lib/maintenance-storage';

/** Request Android notification permission. Call once on app start. */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display === 'granted') return true;

    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  } catch {
    // Plugin not available (web / old Capacitor) — silently ignore
    return false;
  }
}

/** Cancel all previously scheduled maintenance reminders, then re-schedule. */
export async function scheduleMaintenceNotifications(): Promise<void> {
  try {
    // Clear old ones first
    const pending = await LocalNotifications.getPending();
    const maintIds = pending.notifications
      .filter(n => n.id >= 10000 && n.id < 20000)
      .map(n => ({ id: n.id }));
    if (maintIds.length > 0) {
      await LocalNotifications.cancel({ notifications: maintIds });
    }

    const alerts = getDueSoonEvents();
    if (alerts.length === 0) return;

    const notifications: ScheduleOptions['notifications'] = alerts.map((alert, i) => {
      // Fire immediately (or at 08:00 today/tomorrow)
      const fireDate = new Date();
      if (!alert.isToday) {
        fireDate.setDate(fireDate.getDate() + 1);
      }
      fireDate.setHours(8, 0, 0, 0);
      // If that time has already passed today, fire in 5 seconds
      const at = fireDate < new Date() ? new Date(Date.now() + 5000) : fireDate;

      return {
        id: 10000 + i,
        title: alert.isToday ? '🔧 Maintenance Due Today' : '📅 Maintenance Tomorrow',
        body: `${alert.title} — ${alert.priority} priority`,
        schedule: { at },
        sound: undefined,
        smallIcon: 'ic_stat_icon_config_sample',
        channelId: 'maintenance',
      };
    });

    await LocalNotifications.schedule({ notifications });
  } catch {
    // Silently fail on web
  }
}

/** Create the notification channel (Android 8+). Call once on app start after permission granted. */
export async function createNotificationChannel(): Promise<void> {
  try {
    await LocalNotifications.createChannel({
      id: 'maintenance',
      name: 'Maintenance Reminders',
      description: 'Reminders for upcoming maintenance events',
      importance: 4, // HIGH
      sound: 'default',
      vibration: true,
      visibility: 1,
    });
  } catch {
    // Silently fail on web
  }
}
