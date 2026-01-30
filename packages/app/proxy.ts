import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    // auth 路由不需要 locale 前缀，直接处理认证
    const isAuthRoute = pathname.startsWith('/auth/callback') || pathname.startsWith('/auth/v1/callback');

    if (isAuthRoute) {
        // 对于 auth 路由，只处理认证，不处理 i18n
        const authResponse = await updateSession(request);
        return authResponse || NextResponse.next();
    }

    // 先处理 i18n 路由
    const intlResponse = intlMiddleware(request);

    // 如果 i18n 中间件返回了重定向响应，直接返回
    if (intlResponse && intlResponse.status >= 300 && intlResponse.status < 400) {
        return intlResponse;
    }

    // 处理 Supabase 认证
    const authResponse = await updateSession(request);

    // 如果认证中间件返回了重定向响应，直接返回
    if (authResponse && authResponse.status >= 300 && authResponse.status < 400) {
        return authResponse;
    }

    // 合并响应：使用 intl 响应作为基础，应用 auth 的 cookies
    if (intlResponse) {
        // 将 auth 的 cookies 复制到 intl 响应
        // 避免重复设置相同的 cookie，防止请求头过大
        if (authResponse) {
            const existingCookies = new Set(
                intlResponse.cookies.getAll().map(c => c.name)
            );
            authResponse.cookies.getAll().forEach((cookie: { name: string; value: string; options?: any }) => {
                // 只在 cookie 不存在或值不同时才设置，避免重复
                if (!existingCookies.has(cookie.name) ||
                    intlResponse.cookies.get(cookie.name)?.value !== cookie.value) {
                    intlResponse.cookies.set(cookie.name, cookie.value, cookie);
                }
            });
        }
        return intlResponse;
    }

    // 如果没有 intl 响应，返回 auth 响应
    return authResponse || NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - api routes
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};

