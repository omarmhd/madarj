/** كلمة في الذاكرة — بحالة FSRS كما تصل من الخادم */
export interface MemoryWord {
  id: number;
  term: string;
  translation: string | null;
  /** من أين جاء المعنى: مفردات الكتاب · آلة · بيده */
  source: 'course' | 'auto' | 'manual';
  state: 'new' | 'learning' | 'review' | 'relearning';
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  due_at: string | null;
  last_reviewed_at: string | null;
}

/** ما يحمله الزرّ: رقمٌ لا أكثر */
export interface MemoryCounts {
  total: number;
  due: number;
  fresh: number;
}
