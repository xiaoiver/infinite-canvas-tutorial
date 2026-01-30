# Supabase 认证设置指南

本指南将帮助您配置 Supabase 用户认证功能。

## 1. 创建 Supabase 项目

1. 访问 [Supabase](https://supabase.com) 并登录
2. 创建一个新项目
3. 等待项目初始化完成

## 2. 获取 API 密钥

1. 在 Supabase 项目仪表板中，进入 **Settings** > **API**
2. 复制以下信息：
    - **Project URL** (NEXT_PUBLIC_SUPABASE_URL)
    - **anon/public key** (NEXT_PUBLIC_SUPABASE_ANON_KEY)

## 3. 配置环境变量

1. 在 `packages/app` 目录下创建 `.env.local` 文件
2. 添加以下环境变量：

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## 4. 配置 Supabase 认证

### 启用邮箱认证

1. 在 Supabase 项目仪表板中，进入 **Authentication** > **Providers**
2. 确保 **Email** 提供商已启用
3. 配置邮箱设置（可选）：
    - 自定义邮箱模板
    - 设置邮箱验证链接有效期
    - 配置重定向 URL

### 配置重定向 URL

在 **Authentication** > **URL Configuration** 中设置：

-   **Site URL**: `http://localhost:3000` (开发环境) 或您的生产环境 URL
-   **Redirect URLs**: 添加以下 URL：
    -   `http://localhost:3000/**` (开发环境)
    -   `http://localhost:3000/auth/callback` (OAuth 回调)
    -   如果部署到生产环境，也要添加生产环境的 URL

### 启用 Google OAuth 登录

1. 在 Supabase 项目仪表板中，进入 **Authentication** > **Providers**
2. 找到 **Google** 提供商并点击启用
3. 配置 Google OAuth：

#### 在 Google Cloud Console 中创建 OAuth 凭据

    1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
    2. 创建新项目或选择现有项目
    3. 启用 **Google+ API**：
        - 进入 **APIs & Services** > **Library**
        - 搜索 "Google+ API" 并启用
    4. 创建 OAuth 2.0 客户端 ID：

        - 进入 **APIs & Services** > **Credentials**
        - 点击 **Create Credentials** > **OAuth client ID**
        - 选择 **Web application**
        - 添加授权重定向 URI：

            ```
            https://<your-project-ref>.supabase.co/auth/v1/callback
            ```

            （您可以在 Supabase 项目的 **Authentication** > **Providers** > **Google** 页面找到这个 URL）
        - 点击 **Create**
        - 复制 **Client ID** 和 **Client Secret**

    5. 在 Supabase 中配置：
        - 回到 Supabase 的 **Authentication** > **Providers** > **Google** 页面
        - 粘贴 **Client ID** 和 **Client Secret**
        - 点击 **Save**

    **注意**：确保重定向 URI 与 Supabase 提供的完全匹配，包括协议（https）和路径。

## 5. 运行应用

```bash
cd packages/app
pnpm dev
```

## 功能说明

### 已实现的功能

-   ✅ 用户注册（邮箱 + 密码）
-   ✅ 用户登录（邮箱 + 密码）
-   ✅ Google OAuth 登录
-   ✅ 会话管理
-   ✅ 路由保护（未登录用户自动重定向到登录页）
-   ✅ 认证状态监听

### 使用方式

1. **注册新用户**：

    - 访问应用首页
    - 点击"注册"标签
    - 输入邮箱和密码（至少 6 个字符）
    - 点击"注册"按钮
    - 检查邮箱以验证账户（如果启用了邮箱验证）

2. **登录**：

    - 访问应用首页
    - 在"登录"标签中输入邮箱和密码
    - 点击"登录"按钮

3. **使用 Google 登录**：

    - 访问应用首页
    - 点击"使用 Google 登录"按钮
    - 在弹出窗口中选择 Google 账户
    - 授权后自动登录

4. **登出**：
    - 点击右上角的用户头像
    - 在下拉菜单中选择"登出"

## 自定义配置

### 修改认证流程

-   登录组件：`packages/app/components/auth/login-form.tsx`
-   认证上下文：`packages/app/contexts/auth-context.tsx`
-   中间件配置：`packages/app/middleware.ts`

### 添加其他认证方式

Supabase 支持多种认证提供商（GitHub、Apple、Discord 等）。您可以在 Supabase 仪表板中启用这些提供商，然后在代码中使用类似的方式添加登录方法。

例如，要添加 GitHub 登录：

1. 在 Supabase 中启用 GitHub 提供商
2. 在 `auth-context.tsx` 中添加 `signInWithGitHub` 方法
3. 在 `login-form.tsx` 中添加 GitHub 登录按钮

## 故障排除

### 常见问题

1. **"Cannot find module '@supabase/ssr'"**

    - 运行 `pnpm install` 确保依赖已安装

2. **环境变量未加载**

    - 确保 `.env.local` 文件在 `packages/app` 目录下
    - 重启开发服务器

3. **认证状态不更新**

    - 检查浏览器控制台是否有错误
    - 确认 Supabase URL 和密钥配置正确

4. **Google 登录失败**
    - 确认已在 Supabase 中正确配置 Google OAuth 凭据
    - 检查 Google Cloud Console 中的重定向 URI 是否与 Supabase 提供的完全匹配
    - 确保 Google+ API 已启用
    - 检查浏览器控制台是否有错误信息

## 参考资源

-   [Supabase 文档](https://supabase.com/docs)
-   [Supabase Auth 文档](https://supabase.com/docs/guides/auth)
-   [Next.js + Supabase 指南](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
