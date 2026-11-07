import { LocalNotifications } from '@capacitor/local-notifications';
import { isNativeApp } from '@/lib/native';

/**
 * A daily study reminder, inside the app only.
 *
 * The course stands on one question: does the learner come back
 * tomorrow? A reminder at the same hour each evening is the one native
 * feature that answers it, and it is also what makes the app more than
 * the website in a frame, which the stores reject.
 *
 * Scheduled on the phone, so no server and no push service. Asked for
 * once; a learner who says no is not asked again on every launch.
 */
const REMINDER_ID = 1;
const HOUR = 20;

export async function ensureDailyReminder(english: boolean): Promise<void> {
  if (!isNativeApp()) return;

  try {
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') {
      perm = await LocalNotifications.requestPermissions();
    }
    if (perm.display !== 'granted') return;

    const { notifications } = await LocalNotifications.getPending();
    if (notifications.some((n) => n.id === REMINDER_ID)) return;

    await LocalNotifications.schedule({
      notifications: [{
        id: REMINDER_ID,
        title: english ? 'Lesson reminder' : 'تذكير الدرس',
        body: english
          ? "Today's lesson is waiting — a short hour keeps your streak going."
          : 'درسك اليوم ينتظرك — ساعة صغيرة تبني سلسلتك.',
        schedule: { on: { hour: HOUR, minute: 0 }, repeats: true },
      }],
    });
  } catch {
    // A reminder is a help, not a condition: the lesson works without it
  }
}
