# منصة تعلّم الإنجليزية — A1 إلى B1

منصة تعلّم تفاعلية مبنية على كتاب من 24 أسبوعاً، بنظام صرامة يومي
وتكرار متباعد ومحادثة صوتية بلا ملفات صوتية على الخادم.

---

## ما بداخل هذه الحزمة

```
platform/
├── database/migrations/     13 هجرة موثّقة بالعربية
├── app/Models/              14 نموذج Eloquent بعلاقاتها
├── app/Console/Commands/    أمر استيراد المحتوى
├── content/week-01.json     محتوى الأسبوع الأول كاملاً
├── docs/
│   ├── 01-database-schema.md   تصميم القاعدة ومبرراته
│   └── 02-setup.md             خطوات التشغيل بالتفصيل
└── README.md
```

**هذه ملفات المشروع، لا مشروع Laravel كامل.** أنشئ مشروعاً جديداً
ثم انسخ هذه الملفات فوقه — الخطوات في `docs/02-setup.md`.

---

## التشغيل السريع

```bash
# 1. مشروع جديد
composer create-project laravel/laravel english-platform
cd english-platform

# 2. Inertia + React
composer require inertiajs/inertia-laravel
php artisan inertia:middleware
npm install @inertiajs/react react react-dom
npm install -D @vitejs/plugin-react typescript @types/react @types/react-dom

# 3. المصادقة
composer require laravel/breeze --dev
php artisan breeze:install react --typescript

# 4. انسخ ملفات هذه الحزمة
cp -r platform/database/migrations/*  database/migrations/
cp -r platform/app/Models/*           app/Models/
cp -r platform/app/Console/Commands/* app/Console/Commands/
cp -r platform/content                ./

# 5. قاعدة البيانات
touch database/database.sqlite     # أو اضبط PostgreSQL في .env
php artisan migrate
php artisan content:import
```

**النتيجة المتوقعة:**

```
→ week-01.json
   أسبوع 1: Sounds, Greetings & Introducing Yourself
   • أيام: 7
   • مفردات: 100 في 4 مجموعات
   • حوارات: 2 (24 سطراً)
   • تمارين: 18
   • أزواج صوتية: 12
✓ اكتمل الاستيراد.
```

---

## الحزمة التقنية

| الطبقة | التقنية |
|---|---|
| الخادم | Laravel 12 · PHP 8.3 |
| الجسر | Inertia.js |
| الواجهة | React 18 + TypeScript |
| التنسيق | Tailwind (RTL) + shadcn/ui |
| القاعدة | PostgreSQL (SQLite للتطوير) |
| الطوابير | Redis + Horizon |
| بلا إنترنت | PWA + Dexie (IndexedDB) |
| التكرار المتباعد | ts-fsrs |
| الصوت | Web Speech API — بلا ملفات على الخادم |

---

## ثلاثة قرارات معمارية

**١. المحتوى مفصول عن التقدّم.**
ستة جداول للمحتوى (تُقرأ كثيراً، تُكتب نادراً) وسبعة للتقدّم (تُكتب باستمرار).
خلطهما يعني إبطال الـ cache عند كل نقرة من أي مستخدم.

**٢. التسجيلات الصوتية لا تُرفع للخادم.**
تبقى في IndexedDB عند المستخدم، والخادم يحفظ البيانات الوصفية فقط.
السبب: التكلفة (عشرات الجيجابايت لألف مستخدم)، والخصوصية، وأن قيمة
التسجيل في أن يسمعه هو لا نحن.

**٣. التصحيح على الخادم دائماً.**
`Exercise::$hidden = ['answer']` — الإجابة لا تصل المتصفح أبداً.

---

## حالة المشروع

| المرحلة | الحالة |
|---|---|
| مخطط قاعدة البيانات | ✅ مكتمل وموثّق |
| الهجرات (13) | ✅ |
| النماذج (14) | ✅ |
| أمر استيراد المحتوى | ✅ |
| محتوى الأسبوع الأول | ✅ |
| خدمة التقدّم والقفل | ⏳ التالي |
| صفحات React | ⏳ |
| لعبة التمييز الصوتي | ⏳ |
| التكرار المتباعد | ⏳ |
| محتوى الأسابيع 2–24 | ⏳ |
