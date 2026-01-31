import { eq, desc } from 'drizzle-orm';
import { db, type Project, type NewProject } from './index';
import { projects } from './schema';

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
 */
export async function createProject(data: Omit<NewProject, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
  const result = await db
    .insert(projects)
    .values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return result[0];
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

