/**
 * 在此注册可访问的滤镜 / 小工具。将来为每个 id 增加 `app/[locale]/tools/<id>/page.tsx` 即可深链。
 * `useTranslations('tools')` 下需存在 `items.<id>.title`。
 */
export type ToolEntryStatus = 'ready' | 'comingSoon';

export type ToolEntry = {
    id: string;
    /** 相对 `/{locale}/tools` 的路径，省略则仅展示占位卡片 */
    path?: `/${string}`;
    status: ToolEntryStatus;
};

export const toolEntries: ToolEntry[] = [
    {
        id: 'photoColors',
        path: '/photo-colors',
        status: 'ready',
    },
    {
        id: 'glitch',
        path: '/glitch',
        status: 'ready',
    },
];
