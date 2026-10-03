import Dexie, { type Table } from 'dexie';

/**
 * تخزين التسجيلات الصوتية محلياً في IndexedDB.
 *
 * الملفات لا تُرفع للخادم إطلاقاً. هذا الملف هو كل ما يلزم:
 * حفظ، جلب، حذف. المرجع المحلي (local_ref) هو ما يُخزَّن
 * على الخادم لربط البيانات الوصفية بالملف.
 */

interface StoredRecording {
  ref: string;
  weekNumber: number;
  blob: Blob;
  createdAt: number;
}

class RecordingsDB extends Dexie {
  recordings!: Table<StoredRecording, string>;

  constructor() {
    super('english-platform');
    this.version(1).stores({
      recordings: 'ref, weekNumber, createdAt',
    });
  }
}

const db = new RecordingsDB();

/** حفظ تسجيل وإرجاع مرجعه المحلي */
export async function saveRecording(weekNumber: number, blob: Blob): Promise<string> {
  const ref = `w${weekNumber}-${Date.now()}`;

  await db.recordings.put({
    ref,
    weekNumber,
    blob,
    createdAt: Date.now(),
  });

  return ref;
}

/** جلب تسجيل للتشغيل */
export async function getRecording(ref: string): Promise<Blob | null> {
  const row = await db.recordings.get(ref);
  return row?.blob ?? null;
}

/** كل تسجيلات أسبوع معيّن */
export async function getWeekRecordings(weekNumber: number) {
  return db.recordings.where('weekNumber').equals(weekNumber).toArray();
}

/** حذف تسجيل */
export async function deleteRecording(ref: string): Promise<void> {
  await db.recordings.delete(ref);
}
