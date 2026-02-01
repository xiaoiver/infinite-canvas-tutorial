import { eq, desc } from 'drizzle-orm';
import { db, type Project, type NewProject } from './index';
import { projects, chats } from './schema';

/**
 * 获取用户的所有项目
 */
export async function getUserProjects(userId: string): Promise<Project[]> {
  return await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.createdAt));
}

/**
 * 根据 ID 获取项目
 */
export async function getProjectById(projectId: string, userId: string): Promise<Project | null> {
  const result = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  const project = result[0];

  // 确保用户只能访问自己的项目
  if (project && project.userId === userId) {
    return project;
  }

  return null;
}

/**
 * 创建新项目
 * 会自动创建一个默认的 chat（标题为空）
 */
export async function createProject(data: Omit<NewProject, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
  // 使用事务确保原子性
  return await db.transaction(async (tx) => {
    // 创建项目
    const projectResult = await tx
      .insert(projects)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const project = projectResult[0];

    // 创建默认 chat（标题为空）
    await tx
      .insert(chats)
      .values({
        projectId: project.id,
        title: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    return project;
  });
}

/**
 * 更新项目
 */
export async function updateProject(
  projectId: string,
  userId: string,
  data: Partial<Omit<NewProject, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<Project | null> {
  // 首先验证项目属于该用户
  const existingProject = await getProjectById(projectId, userId);
  if (!existingProject) {
    return null;
  }

  const result = await db
    .update(projects)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .returning();

  return result[0] || null;
}

/**
 * 删除项目
 */
export async function deleteProject(projectId: string, userId: string): Promise<boolean> {
  // 首先验证项目属于该用户
  const existingProject = await getProjectById(projectId, userId);
  if (!existingProject) {
    return false;
  }

  await db
    .delete(projects)
    .where(eq(projects.id, projectId));

  return true;
}

