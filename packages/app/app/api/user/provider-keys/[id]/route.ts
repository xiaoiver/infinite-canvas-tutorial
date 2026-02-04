import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  updateUserProviderKey,
  deleteUserProviderKey,
} from '@/lib/db/user-preferences';

/**
 * PUT /api/user/provider-keys/[id]
 * 更新 provider key
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const body = await req.json();
    const { provider, apiKeyEncrypted, label } = body;

    const key = await updateUserProviderKey(
      id,
      user.id,
      {
        provider,
        apiKeyEncrypted,
        label: label !== undefined ? label : undefined,
      }
    );

    if (!key) {
      return NextResponse.json(
        { error: 'Provider key not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json(key);
  } catch (error) {
    console.error('Error updating provider key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/provider-keys/[id]
 * 删除 provider key
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const success = await deleteUserProviderKey(id, user.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Provider key not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting provider key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

