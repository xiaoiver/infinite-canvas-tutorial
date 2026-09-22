/**
 * Yjs 画布数据管理器
 * 封装 Yjs 文档、IndexedDB 持久化和节点同步逻辑
 */

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
// @ts-ignore
import deepEqual from 'deep-equal';
import type { SerializedNode } from '@infinite-canvas-tutorial/ecs';

// 用于标识本地操作的唯一标识符
const LOCAL_ORIGIN = Math.random().toString();

interface NodeWithVersion {
    version?: number;
    isDeleted?: boolean;
    [key: string]: any;
}

/**
 * 画布 Yjs 管理器
 * 负责管理 Yjs 文档、IndexedDB 持久化和节点同步
 */
export class CanvasYjsManager {
    private doc: Y.Doc;
    private yArray: Y.Array<Y.Map<any>>;
    private indexeddbProvider: IndexeddbPersistence;
    private projectId: string;

    constructor(projectId: string) {
        this.projectId = projectId;
        this.doc = new Y.Doc();
        this.yArray = this.doc.getArray('nodes');

        // 创建 IndexedDB provider 用于本地持久化
        this.indexeddbProvider = new IndexeddbPersistence(
            `infinite-canvas-data-${projectId}`,
            this.doc
        );
    }

    /**
     * 等待 IndexedDB 同步完成
     */
    async waitForSync(): Promise<void> {
        return new Promise<void>((resolve) => {
            this.indexeddbProvider.on('synced', () => {
                resolve();
            });
        });
    }

    /**
     * 同步本地节点到 Yjs 数组
     * @param nodes 要同步的节点数组
     */
    recordLocalOps(nodes: readonly NodeWithVersion[]): void {
        this.doc.transact(() => {
            // 过滤掉已删除的节点
            const validNodes = nodes.filter((e) => !e.isDeleted);

            // 同步数组长度
            while (this.yArray.length < validNodes.length) {
                const map = new Y.Map();
                this.yArray.push([map]);
            }

            while (this.yArray.length > validNodes.length) {
                this.yArray.delete(this.yArray.length - 1, 1);
            }

            // 同步每个节点的属性
            const n = validNodes.length;
            for (let i = 0; i < n; i++) {
                const map = this.yArray.get(i) as Y.Map<any> | undefined;
                if (!map) {
                    break;
                }

                const elem = validNodes[i];
                const currentVersion = map.get('version');

                // 如果版本相同，跳过更新
                if (currentVersion === elem.version) {
                    continue;
                }

                // 更新所有属性
                for (const [key, value] of Object.entries(elem)) {
                    const src = map.get(key);
                    if (
                        (typeof src === 'object' && !deepEqual(src, value)) ||
                        src !== value
                    ) {
                        map.set(key, value);
                    }
                }
            }
        }, LOCAL_ORIGIN);
    }

    /**
     * 从 Yjs 加载已保存的节点
     * @returns 序列化后的节点数组
     */
    loadNodes(): SerializedNode[] {
        if (this.yArray.length === 0) {
            return [];
        }

        return this.yArray
            .toArray()
            .map((map: Y.Map<any>) => map.toJSON()) as SerializedNode[];
    }

    /**
     * 销毁管理器，清理资源
     */
    destroy(): void {
        if (this.indexeddbProvider) {
            this.indexeddbProvider.destroy();
        }
        if (this.doc) {
            this.doc.destroy();
        }
    }

    /**
     * 获取 Yjs 文档（用于高级用法）
     */
    getDoc(): Y.Doc {
        return this.doc;
    }

    /**
     * 获取 Yjs 数组（用于高级用法）
     */
    getYArray(): Y.Array<Y.Map<any>> {
        return this.yArray;
    }
}

