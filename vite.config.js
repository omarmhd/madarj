import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [
        laravel({
            input: 'resources/js/app.tsx',
            refresh: true,
        }),
        react(),
    ],
    resolve: {
        alias: { '@': path.resolve(__dirname, 'resources/js') },
    },

    // الربط على 127.0.0.1 صريحاً.
    // بدونه يربط Vite على localhost الذي يُحلّ إلى ::1 على Windows،
    // فيكتب laravel-vite-plugin في public/hot عنوان IPv6 حرفياً
    // (http://[::1]:5173). ومن يفتح الموقع على 127.0.0.1 يطلب
    // السكربتات من أصل مختلف، فقد تفشل صامتة وتظهر صفحة بيضاء.
    server: {
        host: '127.0.0.1',
    },
});
