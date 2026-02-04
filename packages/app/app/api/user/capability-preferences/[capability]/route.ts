import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  getUserCapabilityPreference,
  deleteUserCapabilityPreference,
} from '@/lib/db/user-preferences';
import { isValidCapability } from '@/lib/models/capabilities';

/**
 * GET /api/user/capability-preferences/[capability]
 * 获取用户指定能力的偏好
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ capability: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { capability } = await params;

    if (!isValidCapability(capability)) {
      return NextResponse.json(
        { error: 'Invalid capability' },
        { status: 400 }
      );
    }

    const preference = await getUserCapabilityPreference(user.id, capability);
    return NextResponse.json(preference);
  } catch (error) {
    console.error('Error fetching capability preference:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/capability-preferences/[capability]
 * 删除用户指定能力的偏好
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ capability: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { capability } = await params;

    if (!isValidCapability(capability)) {
      return NextResponse.json(
        { error: 'Invalid capability' },
        { status: 400 }
      );
    }

    await deleteUserCapabilityPreference(user.id, capability);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting capability preference:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

