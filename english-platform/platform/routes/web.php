<?php

use App\Http\Controllers\ExerciseController;
use App\Http\Controllers\ProgressController;
use App\Http\Controllers\RecordingController;
use App\Http\Controllers\WeekController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| مسارات المنصة
|--------------------------------------------------------------------------
|
| كل المسارات تتطلّب مصادقة — لا يوجد محتوى عام.
| ملاحظة: /week/{week} يستخدم رقم الأسبوع لا المعرّف،
| بفضل getRouteKeyName في نموذج Week.
|
*/


    // لوحة التقدّم — نقطة الدخول
    Route::get('/dashboard', [WeekController::class, 'dashboard'])
        ->name('dashboard');

    // صفحة الأسبوع
    Route::get('/week/{week}', [WeekController::class, 'show'])
        ->name('week.show');

    // تحديث التقدّم — تُنادى من مربعات التأشير
    Route::post('/progress/task', [ProgressController::class, 'toggleTask'])
        ->name('progress.task');

    Route::post('/progress/test', [ProgressController::class, 'recordTest'])
        ->name('progress.test');

    // تصحيح التمارين — على الخادم دائماً
    Route::post('/exercises/{exercise}/check', [ExerciseController::class, 'check'])
        ->name('exercises.check');

    // سجل التسجيلات — بيانات وصفية فقط، بلا ملفات صوتية
    Route::post('/recordings', [RecordingController::class, 'store'])
        ->name('recordings.store');

    Route::get('/recordings', [RecordingController::class, 'index'])
        ->name('recordings.index');

// require __DIR__.'/auth.php';
