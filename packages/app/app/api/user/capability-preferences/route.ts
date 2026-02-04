import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  getUserCapabilityPreferences,
  upsertUserCapabilityPreference,
} from '@/lib/db/user-preferences';
import { isValidCapability } from '@/lib/models/capabilities';

/**
 * GET /api/user/capability-preferences
 * 获取用户的所有能力偏好
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

    const preferences = await getUserCapabilityPreferences(user.id);
    return NextResponse.json(preferences);
  } catch (error) {
    console.error('Error fetching capability preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/capability-preferences
 * 创建或更新用户的能力偏好
 */
export async function PUT(req: Request) {
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
    const { capability, provider, model, providerKeyId, config } = body;

    if (!capability || !provider || !model) {
      return NextResponse.json(
        { error: 'Capability, provider, and model are required' },
        { status: 400 }
      );
    }

    if (!isValidCapability(capability)) {
      return NextResponse.json(
        { error: 'Invalid capability' },
        { status: 400 }
      );
    }

    const preference = await upsertUserCapabilityPreference(
      {
        userId: user.id,
        capability,
        provider,
        model,
        providerKeyId: providerKeyId || null,
        config: config || null,
      },
      user.id
    );

    if (!preference) {
      return NextResponse.json(
        { error: 'Failed to save capability preference' },
        { status: 500 }
      );
    }

    return NextResponse.json(preference);
  } catch (error) {
    console.error('Error saving capability preference:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

