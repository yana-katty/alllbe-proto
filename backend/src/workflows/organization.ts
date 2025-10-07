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
import { Result } from 'neverthrow';

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
        const workosOrgResult = await createWorkosOrganizationActivity({
            name: input.name,
            domains: input.domains,
        });
        console.log("WorkOS Organization creation result:", workosOrgResult);

        if (!workosOrgResult.ok) {
            throw new ApplicationFailure(
                `WorkOS Organization creation failed: ${workosOrgResult.error.message}`,
                workosOrgResult.error.code,
                false
            );
        }

        const workosOrg = workosOrgResult.value;
        compensations.unshift({
            message: `Deleting WorkOS Organization: ${workosOrg.id}`,
            fn: async () => {
                const deleteResult = await deleteWorkosOrganizationActivity(workosOrg.id);
                if (!deleteResult.ok) {
                    log.error('Failed to delete WorkOS Organization', { error: deleteResult.error });
                }
            },
        });

        // Step 2: DB Organization 作成（WorkOS Organization ID を id として使用）
        log.info('Creating DB Organization', { workosOrgId: workosOrg.id });
        const dbOrgInput: OrganizationCreateInput = {
            id: workosOrg.id, // WorkOS Organization ID を主キーとして使用
        };
        const dbOrgResult = await insertOrganization(dbOrgInput);
        console.log("DB Organization creation result:", dbOrgResult.);

        if (new Result(dbOrgResult).isErr()) {
            throw new ApplicationFailure(
                `DB Organization creation failed: ${dbOrgResult.error.message}`,
                dbOrgResult.error.code,
                false
            );
        }

        const dbOrg = dbOrgResult.value;
        compensations.unshift({
            message: `Deleting DB Organization: ${dbOrg.id}`,
            fn: async () => {
                const deleteResult = await removeOrganization(dbOrg.id);
                if (deleteResult.isErr()) {
                    log.error('Failed to delete DB Organization', { error: deleteResult.error });
                }
            },
        });

        // Step 3: 管理者ユーザーを WorkOS に作成（オプション）
        if (input.adminUser) {
            log.info('Creating WorkOS admin user', { email: input.adminUser.email });
            const userResult = await createWorkosUserActivity({
                email: input.adminUser.email,
                firstName: input.adminUser.firstName,
                lastName: input.adminUser.lastName,
                emailVerified: false,
            });

            if (!userResult.ok) {
                log.warn('Failed to create admin user, but continuing', { error: userResult.error });
            } else {
                const user = userResult.value;

                // Organization に関連付け
                const membershipResult = await createWorkosOrganizationMembershipActivity({
                    userId: user.id,
                    organizationId: workosOrg.id,
                });

                if (!membershipResult.ok) {
                    log.warn('Failed to create organization membership, but continuing', { error: membershipResult.error });
                }
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
