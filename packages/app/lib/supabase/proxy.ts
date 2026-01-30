import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { routing } from '@/i18n/routing'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    const {
        data: { user },
    } = await supabase.auth.getUser()

    // 允许访问登录页面、认证回调和静态资源
    // 支持 locale 路径（如 /zh/login, /en/login）
    const pathname = request.nextUrl.pathname;
    const localePattern = routing.locales.join('|');
    const isAuthRoute =
        pathname.includes('/login') ||
        pathname.startsWith('/auth/callback') ||
        pathname.startsWith('/auth/v1/callback') ||
        pathname.match(new RegExp(`^/(${localePattern})/?$`)) // 匹配根路径或带 locale 的根路径

    if (!user && !isAuthRoute) {
        // 未登录用户重定向到登录页
        // 尝试从路径中提取 locale，如果没有则使用默认 locale
        const localeMatch = pathname.match(new RegExp(`^/(${localePattern})`));
        const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;
        const url = request.nextUrl.clone()
        url.pathname = `/${locale}/login`
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}

