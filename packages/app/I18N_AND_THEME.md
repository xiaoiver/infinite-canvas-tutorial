# i18n 和 Theme 配置说明

本项目已集成 Next.js 推荐的国际化（i18n）和主题切换方案。

## 技术栈

-   **i18n**: [next-intl](https://next-intl-docs.vercel.app/) - Next.js App Router 最推荐的国际化解决方案
-   **Theme**: [next-themes](https://github.com/pacocoursey/next-themes) - 最流行的主题切换库

## 功能特性

### 国际化 (i18n)

-   ✅ 支持英文（en）、中文（zh-Hans）和西班牙语拉丁美洲（es-419）
-   ✅ 基于路由的语言切换（`/en/...`、`/zh-Hans/...` 和 `/es-419/...`）
-   ✅ 自动语言检测和重定向
-   ✅ 类型安全的翻译消息
-   ✅ 类型安全的导航 helpers
-   ✅ 服务端和客户端组件支持

### 主题切换

-   ✅ 支持浅色、深色和跟随系统
-   ✅ 无闪烁的主题切换
-   ✅ 自动保存用户偏好
-   ✅ 与 Tailwind CSS 完美集成

## 使用方法

### 在客户端组件中使用翻译

```tsx
'use client';

import { useTranslations } from 'next-intl';

export function MyComponent() {
    const t = useTranslations('common');

    return <div>{t('loading')}</div>;
}
```

### 在服务端组件中使用翻译

```tsx
import { getTranslations } from 'next-intl/server';

export default async function MyPage() {
    const t = await getTranslations('common');

    return <div>{t('loading')}</div>;
}
```

### 使用类型安全的导航

在客户端组件中使用类型安全的导航 helpers：

```tsx
'use client';

import { Link, useRouter, usePathname } from '@/i18n/navigation';

export function MyComponent() {
    const router = useRouter();
    const pathname = usePathname();

    // 导航到其他页面（自动处理 locale）
    return <Link href="/about">{t('about')}</Link>;
}
```

### 切换主题

主题切换器已集成在 `UserMenu` 组件中，用户可以通过右上角的主题图标切换主题。

### 切换语言

语言切换器已集成在 `UserMenu` 组件中，用户可以通过右上角的地球图标切换语言。

## 添加新的翻译

1. 编辑 `messages/en.json` 添加英文翻译
2. 编辑 `messages/zh-Hans.json` 添加中文翻译
3. 编辑 `messages/es-419.json` 添加西班牙语翻译

例如：

```json
// messages/zh-Hans.json
{
  "common": {
    "welcome": "欢迎"
  },
  "auth": {
    "title": "用户登录"
  }
}

// messages/en.json
{
  "common": {
    "welcome": "Welcome"
  },
  "auth": {
    "title": "User Login"
  }
}
```

## 项目结构

```plaintext
packages/app/
├── i18n/                      # i18n 配置目录（官方推荐结构）
│   ├── request.ts            # 请求配置（处理翻译加载）
│   ├── routing.ts            # 路由配置（定义语言和路由策略）
│   └── navigation.ts         # 导航 helpers（类型安全的导航 API）
├── messages/                  # 翻译文件目录
│   ├── en.json               # 英文翻译
│   ├── zh-Hans.json          # 中文翻译
│   └── es-419.json           # 西班牙语拉丁美洲翻译
├── proxy.ts                   # Next.js proxy（处理 i18n 路由和认证）
├── next.config.ts            # Next.js 配置（指向 i18n/request.ts）
├── app/
│   ├── [locale]/            # 带语言前缀的路由
│   │   ├── layout.tsx       # Locale layout（包含 ThemeProvider）
│   │   ├── page.tsx         # 首页
│   │   └── login/
│   │       └── page.tsx     # 登录页
│   ├── layout.tsx           # 根 layout
│   └── auth/
│       └── callback/
│           └── route.ts     # 认证回调路由
└── components/
    ├── providers/
    │   └── theme-provider.tsx  # 主题提供者
    ├── auth/
    │   ├── login-form.tsx      # 登录表单（已集成 i18n）
    │   └── user-menu.tsx        # 用户菜单（包含主题和语言切换）
    └── ui/
        ├── theme-toggle.tsx    # 主题切换组件
        └── locale-switcher.tsx # 语言切换组件
```

## 配置说明

### 支持的语言

在 `i18n/routing.ts` 中配置：

```typescript
export const routing = defineRouting({
    locales: ['en', 'zh-Hans', 'es-419'],
    defaultLocale: 'en',
    localePrefix: 'always', // 始终在路由中显示 locale 前缀
});
```

### 路由配置

-   `locales`: 支持的语言列表
-   `defaultLocale`: 默认语言（当无法检测语言时使用）
-   `localePrefix`:
    -   `'always'` - 始终在 URL 中显示语言前缀（如 `/en/`, `/zh-Hans/`, `/es-419/`）
    -   `'as-needed'` - 仅在非默认语言时显示前缀
    -   `'never'` - 不在 URL 中显示前缀（使用 cookie 管理）

### 主题配置

在 `components/providers/theme-provider.tsx` 中配置主题选项。

## 核心文件说明

### `i18n/request.ts`

处理每个请求的翻译加载和 locale 验证：

```typescript
export default getRequestConfig(async ({ requestLocale }) => {
    const requested = await requestLocale;
    const locale = hasLocale(routing.locales, requested)
        ? requested
        : routing.defaultLocale;

    return {
        locale,
        messages: (await import(`../messages/${locale}.json`)).default,
    };
});
```

### `i18n/routing.ts`

定义路由配置和导出类型：

```typescript
export const routing = defineRouting({
    locales: ['en', 'zh-Hans', 'es-419'],
    defaultLocale: 'en',
    localePrefix: 'always',
});
```

### `i18n/navigation.ts`

导出类型安全的导航 helpers：

```typescript
export const { Link, redirect, usePathname, useRouter, getPathname } =
    createNavigation(routing);
```

### `proxy.ts`

处理 i18n 路由和 Supabase 认证的中间件：

-   先处理 i18n 路由（语言检测和重定向）
-   然后处理 Supabase 认证
-   合并响应（应用 cookies）

## 路由示例

-   `/` → 自动重定向到 `/en/`（默认语言）
-   `/en/` - 英文首页
-   `/zh-Hans/` - 中文首页
-   `/es-419/` - 西班牙语首页
-   `/en/login` - 英文登录页
-   `/zh-Hans/login` - 中文登录页
-   `/es-419/login` - 西班牙语登录页

## 注意事项

1. **路由前缀**: 所有页面路由都需要包含语言前缀（如 `/en/`、`/zh-Hans/` 或 `/es-419/`）
2. **自动重定向**: Proxy 会自动处理语言检测和重定向
3. **类型安全**: 使用 `@/i18n/navigation` 中的导航 helpers 可以获得类型安全
4. **主题切换**: 使用 `next-themes`，支持 SSR 和客户端切换
5. **翻译文件**: 使用 JSON 格式，支持嵌套结构
6. **服务端组件**: 在 layout 中需要显式传递 `locale` 给 `getMessages({ locale })`

## 已集成 i18n 的组件

-   ✅ `components/auth/login-form.tsx` - 登录表单
-   ✅ `components/auth/user-menu.tsx` - 用户菜单
-   ✅ `components/ui/locale-switcher.tsx` - 语言切换器
-   ✅ `components/ui/theme-toggle.tsx` - 主题切换器
-   ✅ `app/[locale]/page.tsx` - 首页

## 参考文档

-   [next-intl 官方文档](https://next-intl.dev/docs/getting-started/app-router)
-   [next-themes 官方文档](https://github.com/pacocoursey/next-themes)
