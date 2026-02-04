import { eq, and, not } from 'drizzle-orm';
import { db, type UserProviderKey, type NewUserProviderKey, type UserCapabilityPreference, type NewUserCapabilityPreference, type UserPreference, type NewUserPreference } from './index';
import { userProviderKeys, userCapabilityPreferences, userPreferences } from './schema';
import type { Capability } from '@/lib/models/capabilities';

// ==================== user_provider_keys 操作 ====================

/**
 * 获取用户的所有 provider keys
 */
export async function getUserProviderKeys(userId: string): Promise<UserProviderKey[]> {
  return await db
    .select()
    .from(userProviderKeys)
    .where(eq(userProviderKeys.userId, userId))
    .orderBy(userProviderKeys.createdAt);
}

/**
 * 获取用户指定 provider 的 keys
 */
export async function getUserProviderKeysByProvider(
  userId: string,
  provider: string
): Promise<UserProviderKey[]> {
  return await db
    .select()
    .from(userProviderKeys)
    .where(
      and(
        eq(userProviderKeys.userId, userId),
        eq(userProviderKeys.provider, provider)
      )
    )
    .orderBy(userProviderKeys.createdAt);
}

/**
 * 获取用户默认的 provider key（用于某个 provider）
 */
export async function getDefaultUserProviderKey(
  userId: string,
  provider: string
): Promise<UserProviderKey | null> {
  const result = await db
    .select()
    .from(userProviderKeys)
    .where(
      and(
        eq(userProviderKeys.userId, userId),
        eq(userProviderKeys.provider, provider),
        eq(userProviderKeys.isDefault, true)
      )
    )
    .limit(1);

  return result[0] || null;
}

/**
 * 创建 provider key
 */
export async function createUserProviderKey(
  data: Omit<NewUserProviderKey, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<UserProviderKey | null> {
  // 验证 userId 匹配
  if (data.userId !== userId) {
    return null;
  }

  const result = await db
    .insert(userProviderKeys)
    .values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return result[0] || null;
}

/**
 * 更新 provider key
 */
export async function updateUserProviderKey(
  keyId: string,
  userId: string,
  data: Partial<Omit<NewUserProviderKey, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<UserProviderKey | null> {
  // 先验证 key 属于该用户
  const existing = await db
    .select()
    .from(userProviderKeys)
    .where(eq(userProviderKeys.id, keyId))
    .limit(1);

  if (!existing[0] || existing[0].userId !== userId) {
    return null;
  }

  const result = await db
    .update(userProviderKeys)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(userProviderKeys.id, keyId))
    .returning();

  return result[0] || null;
}

/**
 * 删除 provider key
 */
export async function deleteUserProviderKey(
  keyId: string,
  userId: string
): Promise<boolean> {
  // 先验证 key 属于该用户
  const existing = await db
    .select()
    .from(userProviderKeys)
    .where(eq(userProviderKeys.id, keyId))
    .limit(1);

  if (!existing[0] || existing[0].userId !== userId) {
    return false;
  }

  await db
    .delete(userProviderKeys)
    .where(eq(userProviderKeys.id, keyId));

  return true;
}

// ==================== user_capability_preferences 操作 ====================

/**
 * 获取用户的所有能力偏好
 */
export async function getUserCapabilityPreferences(userId: string): Promise<UserCapabilityPreference[]> {
  return await db
    .select()
    .from(userCapabilityPreferences)
    .where(eq(userCapabilityPreferences.userId, userId))
    .orderBy(userCapabilityPreferences.capability);
}

/**
 * 获取用户指定能力的偏好
 */
export async function getUserCapabilityPreference(
  userId: string,
  capability: Capability
): Promise<UserCapabilityPreference | null> {
  const result = await db
    .select()
    .from(userCapabilityPreferences)
    .where(
      and(
        eq(userCapabilityPreferences.userId, userId),
        eq(userCapabilityPreferences.capability, capability)
      )
    )
    .limit(1);

  return result[0] || null;
}

/**
 * 创建或更新用户的能力偏好（upsert）
 */
export async function upsertUserCapabilityPreference(
  data: Omit<NewUserCapabilityPreference, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<UserCapabilityPreference | null> {
  // 验证 userId 匹配
  if (data.userId !== userId) {
    return null;
  }

  // 如果指定了 providerKeyId，验证它属于该用户
  if (data.providerKeyId) {
    const key = await db
      .select()
      .from(userProviderKeys)
      .where(eq(userProviderKeys.id, data.providerKeyId))
      .limit(1);

    if (!key[0] || key[0].userId !== userId) {
      return null;
    }
  }

  const result = await db
    .insert(userCapabilityPreferences)
    .values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [userCapabilityPreferences.userId, userCapabilityPreferences.capability],
      set: {
        provider: data.provider,
        model: data.model,
        providerKeyId: data.providerKeyId,
        config: data.config,
        updatedAt: new Date(),
      },
    })
    .returning();

  return result[0] || null;
}

/**
 * 删除用户的能力偏好
 */
export async function deleteUserCapabilityPreference(
  userId: string,
  capability: Capability
): Promise<boolean> {
  const result = await db
    .delete(userCapabilityPreferences)
    .where(
      and(
        eq(userCapabilityPreferences.userId, userId),
        eq(userCapabilityPreferences.capability, capability)
      )
    );

  return true;
}

// ==================== user_preferences 操作 ====================

/**
 * 获取用户的偏好设置
 */
export async function getUserPreference(userId: string): Promise<UserPreference | null> {
  const result = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  return result[0] || null;
}

/**
 * 创建或更新用户的偏好设置（upsert）
 */
export async function upsertUserPreference(
  data: Omit<NewUserPreference, 'updatedAt'>,
  userId: string
): Promise<UserPreference | null> {
  // 验证 userId 匹配
  if (data.userId !== userId) {
    return null;
  }

  const result = await db
    .insert(userPreferences)
    .values({
      ...data,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        uiTheme: data.uiTheme,
        language: data.language,
        extra: data.extra,
        updatedAt: new Date(),
      },
    })
    .returning();

  return result[0] || null;
}

