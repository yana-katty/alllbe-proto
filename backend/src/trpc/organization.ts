/**
 * Organization tRPC Router
 * 
 * Read操作: Organization Actions を使用（DB + WorkOS 統合データ）
 * CUD操作: Temporal Workflow Client を使用
 */

import { router, publicProcedure } from './base';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Connection, Client, WorkflowIdReusePolicy } from '@temporalio/client';
import {
    createOrganizationWorkflow,
    createOrganizationWithWorkosWorkflow,
} from '../workflows/organization';
import { organizationCreateSchema, organizationUpdateSchema, organizationQuerySchema } from '../activities/db/models/organization';
import { createOrganizationActions } from '../actions/organization';

// Temporal Client (シングルトン)
let temporalClient: Client | null = null;

async function getTemporalClient(): Promise<Client> {
    if (!temporalClient) {
        const connection = await Connection.connect({
            address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
        });
        temporalClient = new Client({ connection });
    }
    return temporalClient;
}

export const organizationRouter = router({
    // ============================================
    // Read Operations (Query) - Organization Actions 使用
    // ============================================

    /**
     * ID指定でOrganizationを取得 (WorkOSデータ統合)
     */
    getById: publicProcedure
        .input(z.string().uuid())
        .query(async ({ input }) => {
            try {
                const actions = await createOrganizationActions();
                return await actions.getById(input);
            } catch (error) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: error instanceof Error ? error.message : 'Organization not found',
                });
            }
        }),

    /**
     * Email指定でOrganizationを取得 (WorkOSデータ統合)
     */
    getByEmail: publicProcedure
        .input(z.string().email())
        .query(async ({ input }) => {
            try {
                const actions = await createOrganizationActions();
                return await actions.getByEmail(input);
            } catch (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to get organization',
                });
            }
        }),

    /**
     * WorkOS ID指定でOrganizationを取得 (WorkOSデータ統合)
     */
    getByWorkosId: publicProcedure
        .input(z.string())
        .query(async ({ input }) => {
            try {
                const actions = await createOrganizationActions();
                return await actions.getByWorkosId(input);
            } catch (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to get organization',
                });
            }
        }),

    /**
     * Organization一覧を取得 (WorkOSデータ統合)
     */
    list: publicProcedure
        .input(organizationQuerySchema)
        .query(async ({ input }) => {
            try {
                const actions = await createOrganizationActions();
                return await actions.list(input);
            } catch (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to list organizations',
                });
            }
        }),

    // ============================================
    // CUD Operations (Mutation via Workflow)
    // ============================================

    /**
     * Organizationを作成 (DB のみ)
     */
    create: publicProcedure
        .input(organizationCreateSchema)
        .mutation(async ({ input }) => {
            try {
                const client = await getTemporalClient();
                const workflowId = `organization-create-${input.email}-${Date.now()}`;

                const handle = await client.workflow.start(createOrganizationWorkflow, {
                    args: [input],
                    taskQueue: 'default',
                    workflowId,
                    workflowIdReusePolicy: WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_ALLOW_DUPLICATE,
                });

                return await handle.result();
            } catch (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to create organization',
                    cause: error,
                });
            }
        }),

    /**
     * Organizationを作成 (WorkOS連携版)
     */
    createWithWorkos: publicProcedure
        .input(organizationCreateSchema.extend({
            domains: z.array(z.string()),
            adminUser: z.object({
                email: z.string().email(),
                firstName: z.string(),
                lastName: z.string(),
            }).optional(),
        }))
        .mutation(async ({ input }) => {
            try {
                const client = await getTemporalClient();
                const workflowId = `organization-workos-create-${input.email}-${Date.now()}`;

                const handle = await client.workflow.start(createOrganizationWithWorkosWorkflow, {
                    args: [input],
                    taskQueue: 'default',
                    workflowId,
                    workflowIdReusePolicy: WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_ALLOW_DUPLICATE,
                });

                return await handle.result();
            } catch (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to create organization with WorkOS',
                    cause: error,
                });
            }
        }),
});
