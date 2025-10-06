// ===================================
// 共有コード（domain層）での使用例
// ===================================

import type { Logger } from '@/shared/logger';
import { ok, err, type Result } from 'neverthrow';

// エラー型の例
interface OrganizationError {
    code: string;
    message: string;
}

// 入力型の例
interface OrganizationInput {
    name: string;
    email: string;
}

// 出力型の例
interface Organization {
    id: string;
    name: string;
    email: string;
}

// 依存関数の型
type InsertOrganization = (data: OrganizationInput) => Promise<Result<Organization, OrganizationError>>;
type FindOrganizationByEmail = (email: string) => Promise<Result<Organization | null, OrganizationError>>;

// 依存の型定義
interface OrganizationDeps {
    logger: Logger;
    insertOrganization: InsertOrganization;
    findOrganizationByEmail: FindOrganizationByEmail;
}

/**
 * 組織を作成する（共有ビジネスロジック）
 * 
 * この関数は tRPC と Temporal の両方から呼び出せます。
 * logger を依存注入することで、どちらの環境でも動作します。
 */
export const createOrganization = (
    deps: Pick<OrganizationDeps, 'logger' | 'insertOrganization' | 'findOrganizationByEmail'>
) => async (input: OrganizationInput): Promise<Result<Organization, OrganizationError>> => {
    // ロガーを使用（tRPC でも Temporal でも同じ）
    deps.logger.info('Creating organization', { email: input.email });

    // メールアドレスの重複チェック
    const existsResult = await deps.findOrganizationByEmail(input.email);
    if (existsResult.isErr()) {
        deps.logger.error('Failed to check email existence', {
            error: existsResult.error,
            email: input.email,
        });
        return err(existsResult.error);
    }

    if (existsResult.value) {
        deps.logger.warn('Email already exists', { email: input.email });
        return err({
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'Email already in use',
        });
    }

    // 組織を作成
    const insertResult = await deps.insertOrganization(input);
    if (insertResult.isErr()) {
        deps.logger.error('Failed to insert organization', {
            error: insertResult.error,
            input,
        });
        return err(insertResult.error);
    }

    deps.logger.info('Organization created successfully', {
        id: insertResult.value.id,
        email: insertResult.value.email,
    });

    return ok(insertResult.value);
};

// ===================================
// tRPC での使用例
// ===================================

// backend/src/trpc/routes/organization.ts
/*
import { trpcLogger } from '@/trpc/logger';
import { createOrganization } from '@/shared/domain/organization';
import { insertOrganization, findOrganizationByEmail } from '@/shared/db/models/organization';
import { db } from '@/shared/db/connection';

// 依存を準備
const deps = {
  logger: trpcLogger,
  insertOrganization: insertOrganization(db),
  findOrganizationByEmail: findOrganizationByEmail(db),
};

// tRPC プロシージャ
export const organizationRouter = t.router({
  create: t.procedure
    .input(organizationSchema)
    .mutation(async ({ input }) => {
      const result = await createOrganization(deps)(input);

      if (result.isErr()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error.message,
        });
      }

      return result.value;
    }),
});
*/

// ===================================
// Temporal Activity での使用例
// ===================================

// backend/src/temporal/activities.ts
/*
import { log as temporalLog } from '@temporalio/activity';
import { createTemporalLogger } from '@/shared/logger';
import { createOrganization } from '@/shared/domain/organization';
import { insertOrganization, findOrganizationByEmail } from '@/shared/db/models/organization';
import { db } from '@/shared/db/connection';

export async function createOrganizationActivity(input: OrganizationInput): Promise<Organization> {
  // Temporal の log を共通インターフェースに変換
  const logger = createTemporalLogger(temporalLog);

  // 依存を準備
  const deps = {
    logger,
    insertOrganization: insertOrganization(db),
    findOrganizationByEmail: findOrganizationByEmail(db),
  };

  // 共有ビジネスロジックを呼び出し
  const result = await createOrganization(deps)(input);

  if (result.isErr()) {
    throw new Error(result.error.message);
  }

  return result.value;
}
*/

// ===================================
// Temporal Workflow での使用例
// ===================================

// backend/src/temporal/workflows.ts
/*
import { log as temporalLog, proxyActivities } from '@temporalio/workflow';
import { createTemporalLogger } from '@/shared/logger/temporal';
import type { createOrganizationActivity } from './activities';

const logger = createTemporalLogger(temporalLog);

const { createOrganizationActivity } = proxyActivities<{
  createOrganizationActivity: typeof createOrganizationActivity
}>({
  startToCloseTimeout: '1 minute',
});

export async function organizationWorkflow(input: OrganizationInput): Promise<Organization> {
  logger.info('Organization workflow started', { email: input.email });

  try {
    const organization = await createOrganizationActivity(input);

    logger.info('Organization workflow completed', {
      id: organization.id,
      email: organization.email,
    });

    return organization;
  } catch (error) {
    logger.error('Organization workflow failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      input,
    });
    throw error;
  }
}
*/

// ===================================
// テストでの使用例
// ===================================

// backend/src/shared/domain/organization.test.ts
/*
import { describe, it, expect, vi } from 'vitest';
import { ok, err } from 'neverthrow';
import { createOrganization } from './organization';
import type { Logger } from '@/shared/logger';

describe('createOrganization', () => {
  it('should create organization when email is unique', async () => {
    // モックロガーを作成
    const mockLogger: Logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn().mockReturnThis(),
    };
    
    const mockOrg = { id: 'org-1', name: 'Test', email: 'test@example.com' };
    
    const mockDeps = {
      logger: mockLogger,
      insertOrganization: vi.fn().mockResolvedValue(ok(mockOrg)),
      findOrganizationByEmail: vi.fn().mockResolvedValue(ok(null)),
    };
    
    const result = await createOrganization(mockDeps)({
      name: 'Test',
      email: 'test@example.com',
    });
    
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual(mockOrg);
    expect(mockLogger.info).toHaveBeenCalledWith('Creating organization', expect.any(Object));
    expect(mockLogger.info).toHaveBeenCalledWith('Organization created successfully', expect.any(Object));
  });
  
  it('should return error when email already exists', async () => {
    const mockLogger: Logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn().mockReturnThis(),
    };
    
    const existingOrg = { id: 'org-existing', name: 'Existing', email: 'test@example.com' };
    
    const mockDeps = {
      logger: mockLogger,
      insertOrganization: vi.fn(),
      findOrganizationByEmail: vi.fn().mockResolvedValue(ok(existingOrg)),
    };
    
    const result = await createOrganization(mockDeps)({
      name: 'Test',
      email: 'test@example.com',
    });
    
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('EMAIL_ALREADY_EXISTS');
    expect(mockLogger.warn).toHaveBeenCalledWith('Email already exists', expect.any(Object));
    expect(mockDeps.insertOrganization).not.toHaveBeenCalled();
  });
});
*/
