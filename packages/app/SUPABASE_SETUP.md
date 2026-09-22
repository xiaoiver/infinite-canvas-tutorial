# Supabase Authentication Setup Guide

This guide will help you configure Supabase user authentication functionality.

## 1. Create a Supabase Project

1. Visit [Supabase](https://supabase.com) and log in
2. Create a new project
3. Wait for the project initialization to complete

## 2. Get API Keys

1. In the Supabase project dashboard, go to **Settings** > **API**
2. Copy the following information:
    - **Project URL** (NEXT_PUBLIC_SUPABASE_URL)
    - **anon/public key** (NEXT_PUBLIC_SUPABASE_ANON_KEY)

## 3. Configure Environment Variables

1. Create a `.env.local` file in the `packages/app` directory
2. Add the following environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## 4. Configure Supabase Authentication

### Enable Email Authentication

1. In the Supabase project dashboard, go to **Authentication** > **Providers**
2. Ensure the **Email** provider is enabled
3. Configure email settings (optional):
    - Customize email templates
    - Set email verification link expiration
    - Configure redirect URLs

### Configure Redirect URLs

In **Authentication** > **URL Configuration**, set:

-   **Site URL**: `http://localhost:3000` (development environment) or your production environment URL
-   **Redirect URLs**: Add the following URLs:
    -   `http://localhost:3000/**` (development environment)
    -   `http://localhost:3000/auth/callback` (OAuth callback)
    -   If deploying to production, also add your production environment URLs

### Enable Google OAuth Login

1. In the Supabase project dashboard, go to **Authentication** > **Providers**
2. Find the **Google** provider and click to enable it
3. Configure Google OAuth:

#### Create OAuth Credentials in Google Cloud Console

    1. Visit [Google Cloud Console](https://console.cloud.google.com/)
    2. Create a new project or select an existing project
    3. Enable **Google+ API**:
        - Go to **APIs & Services** > **Library**
        - Search for "Google+ API" and enable it
    4. Create OAuth 2.0 Client ID:

        - Go to **APIs & Services** > **Credentials**
        - Click **Create Credentials** > **OAuth client ID**
        - Select **Web application**
        - Add authorized redirect URI:

            ```
            https://<your-project-ref>.supabase.co/auth/v1/callback
            ```

            (You can find this URL on the **Authentication** > **Providers** > **Google** page of your Supabase project)
        - Click **Create**
        - Copy the **Client ID** and **Client Secret**

    5. Configure in Supabase:
        - Return to the **Authentication** > **Providers** > **Google** page in Supabase
        - Paste the **Client ID** and **Client Secret**
        - Click **Save**

    **Note**: Ensure the redirect URI exactly matches what Supabase provides, including the protocol (https) and path.

### Enable GitHub OAuth Login

1. In the Supabase project dashboard, go to **Authentication** > **Providers**
2. Find the **GitHub** provider and click to enable it
3. Configure GitHub OAuth:

#### Create OAuth App in GitHub

1. Visit [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **OAuth Apps** > **New OAuth App**
3. Fill in the application information:

    - **Application name**: Your application name (e.g., My App)
    - **Homepage URL**: `http://localhost:3000` (development environment) or your production environment URL
    - **Authorization callback URL**:

        ```plaintext
        https://<your-project-ref>.supabase.co/auth/v1/callback
        ```

        (You can find this URL on the **Authentication** > **Providers** > **GitHub** page of your Supabase project)

4. Click **Register application**
5. Copy the **Client ID**
6. Click **Generate a new client secret** to generate and copy the **Client secret**

7. Configure in Supabase:
    - Return to the **Authentication** > **Providers** > **GitHub** page in Supabase
    - Paste the **Client ID** and **Client Secret**
    - Click **Save**

**Note**:

-   Ensure the callback URL exactly matches what Supabase provides, including the protocol (https) and path
-   If your application needs to access users' private repositories, you can configure the appropriate permission scopes in the GitHub OAuth App settings

## 5. Run the Application

```bash
cd packages/app
pnpm dev
```

## Feature Overview

### Implemented Features

-   ✅ User registration (email + password)
-   ✅ User login (email + password)
-   ✅ Google OAuth login
-   ✅ GitHub OAuth login
-   ✅ Session management
-   ✅ Route protection (unauthenticated users are automatically redirected to the login page)
-   ✅ Authentication state monitoring

### Usage

1. **Register a new user**:

    - Visit the application homepage
    - Click the "Sign Up" tab
    - Enter email and password (at least 6 characters)
    - Click the "Sign Up" button
    - Check your email to verify the account (if email verification is enabled)

2. **Login**:

    - Visit the application homepage
    - Enter email and password in the "Login" tab
    - Click the "Login" button

3. **Login with Google**:

    - Visit the application homepage
    - Click the "Sign in with Google" button
    - Select a Google account in the popup window
    - Automatically logged in after authorization

4. **Login with GitHub**:

    - Visit the application homepage
    - Click the "Sign in with GitHub" button
    - Select a GitHub account in the popup window
    - Automatically logged in after authorization

5. **Logout**:
    - Click the user avatar in the top right corner
    - Select "Logout" from the dropdown menu

## Custom Configuration

### Modify Authentication Flow

-   Login component: `packages/app/components/auth/login-form.tsx`
-   Authentication context: `packages/app/contexts/auth-context.tsx`
-   Middleware configuration: `packages/app/middleware.ts`

### Add Other Authentication Methods

Supabase supports multiple authentication providers (Apple, Discord, Twitter, etc.). You can enable these providers in the Supabase dashboard and then add login methods in the code using similar approaches.

For example, to add other OAuth providers:

1. Enable the corresponding provider in Supabase
2. Add the corresponding login method in `auth-context.tsx` (e.g., `signInWithApple`)
3. Add the corresponding login button in `login-form.tsx`

## Troubleshooting

### Common Issues

1. **"Cannot find module '@supabase/ssr'"**

    - Run `pnpm install` to ensure dependencies are installed

2. **Environment variables not loaded**

    - Ensure the `.env.local` file is in the `packages/app` directory
    - Restart the development server

3. **Authentication state not updating**

    - Check the browser console for errors
    - Verify that the Supabase URL and keys are configured correctly

4. **Google login fails**

    - Verify that Google OAuth credentials are correctly configured in Supabase
    - Check that the redirect URI in Google Cloud Console exactly matches what Supabase provides
    - Ensure Google+ API is enabled
    - Check the browser console for error messages

5. **GitHub login fails**
    - Verify that GitHub OAuth credentials are correctly configured in Supabase
    - Check that the callback URL in GitHub OAuth App exactly matches what Supabase provides
    - Ensure the Client ID and Client Secret are copied correctly (watch out for extra spaces)
    - Check the browser console for error messages

## Reference Resources

-   [Supabase Documentation](https://supabase.com/docs)
-   [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
-   [Next.js + Supabase Guide](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
