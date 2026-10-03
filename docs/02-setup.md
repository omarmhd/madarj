# الإعداد — من صفر إلى قاعدة بيانات مليئة

## ما هو موجود الآن

```
platform/
├── database/migrations/     13 هجرة موثّقة
├── app/Models/              14 نموذجاً بعلاقاتها
├── app/Console/Commands/    أمر الاستيراد
├── content/week-01.json     محتوى الأسبوع الأول كاملاً
└── docs/                    التوثيق
```

**ملاحظة:** هذه ملفات المشروع لا مشروع Laravel كامل. البيئة هنا لا تصل إلى `packagist`، فتُنشأ القاعدة عندك ثم تُنسخ هذه الملفات فوقها.

---

## الخطوات

### 1. إنشاء مشروع Laravel

```bash
composer create-project laravel/laravel english-platform
cd english-platform
```

### 2. تثبيت Inertia مع React

```bash
composer require inertiajs/inertia-laravel
php artisan inertia:middleware

npm install @inertiajs/react react react-dom
npm install -D @vitejs/plugin-react typescript @types/react @types/react-dom
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 3. المصادقة

```bash
composer require laravel/breeze --dev
php artisan breeze:install react --typescript
```

### 4. نسخ ملفات المشروع

```bash
cp -r /path/to/platform/database/migrations/* database/migrations/
cp -r /path/to/platform/app/Models/*           app/Models/
cp -r /path/to/platform/app/Console/Commands/* app/Console/Commands/
cp -r /path/to/platform/content                ./
cp -r /path/to/platform/docs                   ./
```

### 5. قاعدة البيانات

**للتطوير السريع — SQLite:**

```bash
touch database/database.sqlite
```

```env
DB_CONNECTION=sqlite
DB_DATABASE=/absolute/path/to/database/database.sqlite
```

**للإنتاج — MySQL 8:**

```sql
CREATE DATABASE madarij CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'madarij'@'localhost' IDENTIFIED BY '…';
GRANT ALL PRIVILEGES ON madarij.* TO 'madarij'@'localhost';
```

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=madarij
DB_USERNAME=madarij
DB_PASSWORD=secret
```

**الإصدار الأدنى 8.0.13**، وترتيب المقارنة `utf8mb4` لا سواه.

#### ما اختلف عن المحرّكات الأخرى

ثلاثة أشياء لا تظهر إلا حين يُشغَّل على MySQL فعلاً، وقد صُحّحت كلّها،
وتُذكر هنا لأنّ من يكتب هجرةً جديدة سيقع فيها ثانيةً:

| | |
|---|---|
| `CREATE INDEX IF NOT EXISTS` | غير موجود في MySQL، وفهرس التعبير يحتاج قوسين مزدوجين: `((LOWER(word)))`. انظر هجرة `add_lower_word_index_to_vocabulary` |
| `ESCAPE ''` في `LIKE` | الشرطة المائلة محرف هروبٍ **داخل النصوص** في MySQL، فالنصّ غير مغلق ويسقط الاستعلام. محرف الهروب في المشروع `!` |
| `TIMESTAMP` ينتهي 2038 | وFSRS يجدول إلى مئة سنة. عمودا `due_at` من نوع `DATETIME` لهذا السبب |

**والقاعدة المستخلصة:** أيّ هجرة أو استعلامٍ خامّ يُجرَّب على MySQL
قبل الدمج — القراءة لا تكشف هذه الثلاثة، والتشغيل يكشفها في ثوانٍ.

### 6. التشغيل

```bash
php artisan migrate
php artisan content:import
```

**المتوقّع:**

```
→ week-01.json
   أسبوع 1: Sounds, Greetings & Introducing Yourself
   • أيام: 7
   • مفردات: 100 في 4 مجموعات
   • حوارات: 2 (24 سطراً)
   • تمارين: 18 — fill_blank=6 · correct_error=4 · true_false=4 · multiple_choice=4
   • أزواج صوتية: 12

✓ اكتمل الاستيراد.
```

### 7. التأكد

```bash
php artisan tinker
```

```php
$w = App\Models\Week::with('days', 'vocabulary')->first();

$w->title_en;                        // "Sounds, Greetings & ..."
$w->days->count();                   // 7
$w->days->first()->totalMinutes();   // 60
$w->vocabularyByGroup()->keys();     // ["family","numbers","days_months","core"]

// تجربة التصحيح على الخادم
$e = App\Models\Exercise::where('type','fill_blank')->first();
$e->check('is');      // true
$e->check('IS  ');    // true  — يتسامح مع الحالة والمسافات
$e->check('are');     // false
```

---

## أوامر الاستيراد

| الأمر | ماذا يفعل |
|---|---|
| `content:import` | كل الأسابيع الموجودة في `content/` |
| `content:import --week=1` | أسبوع واحد فقط |
| `content:import --fresh` | حذف كل المحتوى القديم أولاً |

**الأمر idempotent** — تشغيله عشر مرات يعطي نفس النتيجة. يستخدم `updateOrCreate` على رقم الأسبوع، ويحذف المحتوى الفرعي قبل إعادة إدخاله.

**وآمن على المستخدمين:** يمسّ جداول المحتوى فقط ولا يقترب من التقدّم. تستطيع تصحيح خطأ في محتوى الأسبوع الثالث بينما مئة شخص يدرسون فيه.

---

## قرارات معمارية تظهر في الكود

| القرار | أين | لماذا |
|---|---|---|
| التصحيح على الخادم | `Exercise::check()` | لو صحّحنا في الواجهة لقرأ المستخدم الإجابات من الـ props |
| `$hidden = ['answer']` | `Exercise` | الإجابة لا تُرسل للمتصفح أبداً |
| `getRouteKeyName` | `Week` | `/week/3` يستخدم الرقم لا المعرّف — لا يتأثر بإعادة الاستيراد |
| التسامح في النص | `Exercise::checkText()` | فرق الحالة والمسافة والترقيم لا يعني خطأ لغوياً |
| `grace_days` | `Streak` | قاعدة الكتاب: يوم فائت ليس فشلاً، يومان خطر |
| حسابات FSRS في المتصفح | `ReviewCard` | توفير حمل الخادم + إمكانية المراجعة بلا إنترنت |
| المنطقة الزمنية في `Enrollment` | `today()` | "اليوم" يختلف بين مستخدم في القاهرة وآخر في تورونتو |

---

## التالي

1. `app/Services/ProgressService.php` — منطق القفل والتقدّم والسلسلة
2. `app/Http/Controllers/` — الصفحات
3. `resources/js/Pages/Today.tsx` — لوحة اليوم بمربعات التأشير
4. لعبة التمييز الصوتي بـ Web Speech API
