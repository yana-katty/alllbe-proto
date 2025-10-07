/**
 * Organization Workflows
 * 
 * Temporal Workflowsとして実行される Organization の CUD操作
 * Read操作は actions/organization.ts に実装
 * 
 * SAGA パターン:
 * - 複数のActivity呼び出しを組み合わせる
 * - 失敗時の補償処理（rollback）を実装
 * - WorkOS + DB の協調処理
 */

import { proxyActivities, ApplicationFailure, log } from '@temporalio/workflow';
import type * as workosActivities from '../activities/auth/workos';
import type { Organization } from '../activities/db/schema';
import type { OrganizationCreateInput, createOrganizationActivities } from '../activities/db/models/organization';

// DB Activity Proxy - ファクトリ関数の戻り値型を使用
const { removeOrganization, insertOrganization } = proxyActivities<ReturnType<typeof createOrganizationActivities>>({
    startToCloseTimeout: '30s',
    retry: {
        initialInterval: '1s',
        maximumInterval: '10s',
        backoffCoefficient: 2,
        maximumAttempts: 3,
    },
});

// WorkOS Activity Proxy
const {
    createWorkosOrganizationActivity,
    deleteWorkosOrganizationActivity,
    createWorkosUserActivity,
    createWorkosOrganizationMembershipActivity,
} = proxyActivities<typeof workosActivities>({
    startToCloseTimeout: '30s',
    retry: {
        initialInterval: '1s',
        maximumInterval: '10s',
        backoffCoefficient: 2,
        maximumAttempts: 3,
    },
});

// 補償処理の型定義
interface Compensation {
    message: string;
    fn: () => Promise<void>;
}

/**
 * 補償処理の実行
 */
async function compensate(compensations: Compensation[]): Promise<void> {
    for (const compensation of compensations) {
        try {
            log.info(`Compensating: ${compensation.message}`);
            await compensation.fn();
        } catch (error) {
            log.error(`Compensation failed: ${compensation.message}`, { error });
            // 補償処理が失敗してもcontinue（ログのみ）
        }
    }
}

// ============================================
// Temporal Workflows (C/U/D)
// ============================================

/**
 * Organization + WorkOS Organization 作成 Workflow
 * 
 * SAGA パターン:
 * 1. WorkOS Organization 作成
 * 2. DB Organization 作成（WorkOS Organization ID を id として使用）
 * 3. 管理者ユーザーを WorkOS に作成（オプション）
 * 4. 失敗時は作成済みリソースを削除
 * 
 * @throws ApplicationFailure - Activity呼び出しのエラーはそのまま伝播
 */
export async function createOrganizationWithWorkosWorkflow(
    input: {
        domains: string[];
        name: string; // WorkOS Organization 作成用
        adminUser?: {
            email: string;
            firstName: string;
            lastName: string;
        };
    }
): Promise<Organization> {
    const compensations: Compensation[] = [];

    try {
        // Step 1: WorkOS Organization 作成
        log.info('Creating WorkOS Organization', { name: input.name });
        const workosOrg = await createWorkosOrganizationActivity({
            name: input.name,
            domains: input.domains,
        });
        console.log("WorkOS Organization creation result:", workosOrg);

        compensations.unshift({
            message: `Deleting WorkOS Organization: ${workosOrg.id}`,
            fn: async () => {
                try {
                    await deleteWorkosOrganizationActivity(workosOrg.id);
                } catch (error) {
                    log.error('Failed to delete WorkOS Organization', { error });
                }
            },
        });

        // Step 2: DB Organization 作成（WorkOS Organization ID を id として使用）
        log.info('Creating DB Organization', { workosOrgId: workosOrg.id });
        const dbOrgInput: OrganizationCreateInput = {
            id: workosOrg.id, // WorkOS Organization ID を主キーとして使用
        };
        const dbOrg = await insertOrganization(dbOrgInput);
        console.log("DB Organization creation result:", dbOrg);

        compensations.unshift({
            message: `Deleting DB Organization: ${dbOrg.id}`,
            fn: async () => {
                try {
                    await removeOrganization(dbOrg.id);
                } catch (error) {
                    log.error('Failed to delete DB Organization', { error });
                }
            },
        });

        // Step 3: 管理者ユーザーを WorkOS に作成（オプション）
        if (input.adminUser) {
            log.info('Creating WorkOS admin user', { email: input.adminUser.email });
            try {
                const user = await createWorkosUserActivity({
                    email: input.adminUser.email,
                    firstName: input.adminUser.firstName,
                    lastName: input.adminUser.lastName,
                    emailVerified: false,
                });

                // Organization に関連付け
                try {
                    await createWorkosOrganizationMembershipActivity({
                        userId: user.id,
                        organizationId: workosOrg.id,
                    });
                } catch (error) {
                    log.warn('Failed to create organization membership, but continuing', { error });
                }
            } catch (error) {
                log.warn('Failed to create admin user, but continuing', { error });
            }
        }

        log.info('Organization creation successful', { dbOrgId: dbOrg.id, workosOrgId: workosOrg.id });
        return dbOrg;

    } catch (error) {
        log.error('Organization creation failed, compensating', { error });
        await compensate(compensations);
        throw error;
    }
}
