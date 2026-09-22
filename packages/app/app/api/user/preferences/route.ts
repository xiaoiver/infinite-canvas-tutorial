import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  getUserProviderKeys,
  getUserCapabilityPreferences,
  getUserPreference,
} from '@/lib/db/user-preferences';

/**
 * GET /api/user/preferences
 * 获取用户的所有偏好设置（包括 provider keys、模型偏好和其他偏好）
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

    const [providerKeys, capabilityPreferences, preferences] = await Promise.all([
      getUserProviderKeys(user.id),
      getUserCapabilityPreferences(user.id),
      getUserPreference(user.id),
    ]);

    return NextResponse.json({
      providerKeys,
      capabilityPreferences,
      preferences,
    });
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

