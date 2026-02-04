import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  getUserProviderKeys,
  createUserProviderKey,
  updateUserProviderKey,
  deleteUserProviderKey,
} from '@/lib/db/user-preferences';

/**
 * GET /api/user/provider-keys
 * 获取用户的所有 provider keys
 * 
 * 安全性说明：
 * - 返回明文 API Key 给已认证的用户是安全的，因为：
 *   1. 这是用户自己的数据
 *   2. 有认证保护（只有用户本人能访问）
 *   3. 数据库有 RLS（Row Level Security）保护
 *   4. 传输使用 HTTPS（生产环境）
 * - 参考 Vercel Dashboard 的做法，用户可以看到自己配置的环境变量
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const keys = await getUserProviderKeys(user.id);
    // 直接返回 API Key（明文）
    // 注意：前端应该默认隐藏显示（使用 password 类型）
    return NextResponse.json(keys);
  } catch (error) {
    console.error('Error fetching provider keys:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/provider-keys
 * 创建新的 provider key
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { provider, apiKeyEncrypted, label } = body;

    if (!provider || !apiKeyEncrypted) {
      return NextResponse.json(
        { error: 'Provider and API key are required' },
        { status: 400 }
      );
    }

    // TODO: 在实际应用中，应该在这里加密 API key
    // 目前假设前端已经加密，或者使用环境变量中的加密密钥
    const key = await createUserProviderKey(
      {
        userId: user.id,
        provider,
        apiKeyEncrypted,
        label: label || null,
      },
      user.id
    );

    if (!key) {
      return NextResponse.json(
        { error: 'Failed to create provider key' },
        { status: 500 }
      );
    }

    // 直接返回 key（包含明文 API Key）
    // 前端会使用 password 类型默认隐藏
    return NextResponse.json(key);
  } catch (error) {
    console.error('Error creating provider key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

