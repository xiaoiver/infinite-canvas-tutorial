# 数据库设置指南

本指南将帮助您设置 projects 表和相关的数据库功能。

## 1. 安装依赖

确保已安装以下依赖：

```bash
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit
```

## 2. 配置环境变量

在 `packages/app/.env.local` 文件中添加数据库连接字符串：

```env
# Supabase 数据库连接字符串
# 格式：postgresql://postgres:[password]@[host]:[port]/postgres
# 您可以在 Supabase 项目设置 > Database > Connection string 中找到
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres
```

**注意**：请使用 Supabase 的数据库连接字符串，而不是 API URL。

## 3. 运行数据库迁移

### 方法 1：使用 Supabase Dashboard（推荐）

1. 登录 Supabase Dashboard
2. 进入 **SQL Editor**
3. 复制 `lib/db/migrations/0000_create_projects.sql` 文件的内容
4. 在 SQL Editor 中执行该 SQL 脚本

### 方法 2：使用 Drizzle Kit（如果已配置）

```bash
# 生成迁移文件
pnpm drizzle-kit generate

# 应用迁移（需要配置数据库连接）
pnpm drizzle-kit migrate
```

## 4. 使用 Projects API

### 获取用户的所有项目

```typescript
import { getUserProjects } from '@/lib/db/projects';

const projects = await getUserProjects(userId);
```

### 创建新项目

```typescript
import { createProject } from '@/lib/db/projects';

const newProject = await createProject({
  userId: 'user-id',
  name: '我的项目',
  description: '项目描述',
});
```

### 更新项目

```typescript
import { updateProject } from '@/lib/db/projects';

const updated = await updateProject(
  'project-id',
  'user-id',
  {
    name: '更新后的项目名',
    description: '更新后的描述',
  }
);
```

### 删除项目

```typescript
import { deleteProject } from '@/lib/db/projects';

const deleted = await deleteProject('project-id', 'user-id');
```

## 5. 在 API Route 中使用

示例：创建 API route 来管理项目

```typescript
// app/api/projects/route.ts
import { createClient } from '@/lib/supabase/server';
import { createProject, getUserProjects } from '@/lib/db/projects';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projects = await getUserProjects(user.id);
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const project = await createProject({
    userId: user.id,
    name: body.name,
    description: body.description,
  });

  return NextResponse.json(project);
}
```

## 6. Row Level Security (RLS)

迁移文件已经配置了 Row Level Security 策略，确保：

- 用户只能查看自己的项目
- 用户只能创建自己的项目
- 用户只能更新自己的项目
- 用户只能删除自己的项目

这些策略在数据库层面强制执行，提供了额外的安全保障。

## 7. 表结构

projects 表包含以下字段：

- `id` (UUID): 主键，自动生成
- `user_id` (UUID): 关联到 auth.users(id)，外键约束
- `name` (TEXT): 项目名称，必填
- `description` (TEXT): 项目描述，可选
- `created_at` (TIMESTAMP): 创建时间，自动设置
- `updated_at` (TIMESTAMP): 更新时间，自动更新

## 故障排除

### 连接错误

- 确保 `DATABASE_URL` 环境变量已正确设置
- 检查 Supabase 项目的数据库连接字符串是否正确
- 确保网络可以访问 Supabase 数据库

### 权限错误

- 确保已运行迁移 SQL 脚本
- 检查 RLS 策略是否正确创建
- 验证用户已通过 Supabase 认证

### 外键约束错误

- 确保 `auth.users` 表存在（Supabase 自动创建）
- 验证外键约束已正确创建
