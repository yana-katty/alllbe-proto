/**
 * ExperienceAsset Actions
 * 
 * Temporal Workflowではない通常の関数として実装
 * 主にRead操作とビジネスロジックを提供し、tRPCから直接呼び出し可能
 * 
 * 依存注入パターンにより、テスト時にActivity関数をモック可能
 * エラーは throw されるため、呼び出し側で try-catch でハンドリング
 */

import type { ExperienceAsset } from '../activities/db/schema';
import type {
    ExperienceAssetCreateInput,
    ExperienceAssetUpdateInput,
    ExperienceAssetQueryInput,
    InsertExperienceAsset,
    FindExperienceAssetById,
    ListExperienceAssets,
    ListExperienceAssetsByExperience,
    UpdateExperienceAsset,
    RemoveExperienceAsset,
} from '../activities/db/models/experienceAssets';
import { ExperienceAssetErrorType, createExperienceAssetError } from '../activities/db/models/experienceAssets';

// 依存関数の型定義
interface ExperienceAssetActionDeps {
    insertExperienceAssetActivity: InsertExperienceAsset;
    findExperienceAssetByIdActivity: FindExperienceAssetById;
    listExperienceAssetsActivity: ListExperienceAssets;
    listExperienceAssetsByExperienceActivity: ListExperienceAssetsByExperience;
    updateExperienceAssetActivity: UpdateExperienceAsset;
    removeExperienceAssetActivity: RemoveExperienceAsset;
}

/**
 * ExperienceAsset 作成
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_ASSET_DATABASE_ERROR) - DB操作エラー
 */
export const createExperienceAsset = (deps: Pick<ExperienceAssetActionDeps, 'insertExperienceAssetActivity'>) =>
    async (data: ExperienceAssetCreateInput): Promise<ExperienceAsset> => {
        return await deps.insertExperienceAssetActivity(data);
    };

/**
 * ExperienceAsset取得 (ID指定)
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_ASSET_DATABASE_ERROR) - DB操作エラー
 */
export const getExperienceAssetById = (deps: Pick<ExperienceAssetActionDeps, 'findExperienceAssetByIdActivity'>) =>
    async (id: string): Promise<ExperienceAsset | null> => {
        return await deps.findExperienceAssetByIdActivity(id);
    };

/**
 * ExperienceAsset一覧取得（検索条件付き）
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_ASSET_DATABASE_ERROR) - DB操作エラー
 */
export const listExperienceAssets = (deps: Pick<ExperienceAssetActionDeps, 'listExperienceAssetsActivity'>) =>
    async (params: ExperienceAssetQueryInput): Promise<ExperienceAsset[]> => {
        return await deps.listExperienceAssetsActivity(params);
    };

/**
 * Experience配下のExperienceAsset一覧取得
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_ASSET_DATABASE_ERROR) - DB操作エラー
 */
export const listExperienceAssetsByExperience = (deps: Pick<ExperienceAssetActionDeps, 'listExperienceAssetsByExperienceActivity'>) =>
    async (experienceId: string, params?: Partial<ExperienceAssetQueryInput>): Promise<ExperienceAsset[]> => {
        return await deps.listExperienceAssetsByExperienceActivity(experienceId, params);
    };

/**
 * ExperienceAsset更新
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_ASSET_NOT_FOUND) - ExperienceAsset が見つからない場合
 * @throws ApplicationFailure (type: EXPERIENCE_ASSET_DATABASE_ERROR) - DB操作エラー
 */
export const updateExperienceAsset = (deps: Pick<ExperienceAssetActionDeps, 'updateExperienceAssetActivity'>) =>
    async (id: string, patch: ExperienceAssetUpdateInput): Promise<ExperienceAsset> => {
        return await deps.updateExperienceAssetActivity(id, patch);
    };

/**
 * ExperienceAsset削除
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_ASSET_NOT_FOUND) - ExperienceAsset が見つからない場合
 * @throws ApplicationFailure (type: EXPERIENCE_ASSET_DATABASE_ERROR) - DB操作エラー
 */
export const deleteExperienceAsset = (deps: Pick<ExperienceAssetActionDeps, 'removeExperienceAssetActivity' | 'findExperienceAssetByIdActivity'>) =>
    async (id: string): Promise<boolean> => {
        // ExperienceAsset存在チェック
        const asset = await deps.findExperienceAssetByIdActivity(id);
        if (!asset) {
            throw createExperienceAssetError({
                type: ExperienceAssetErrorType.NOT_FOUND,
                message: `ExperienceAsset not found: ${id}`,
                details: { assetId: id },
                nonRetryable: true,
            });
        }

        return await deps.removeExperienceAssetActivity(id);
    };

/**
 * ExperienceAsset Actions ファクトリ
 * 全てのAction関数を依存注入で生成
 * 
 * @param deps - ExperienceAsset Activity関数の依存
 * @returns すべてのExperienceAsset Action関数
 */
export function createExperienceAssetActions(deps: ExperienceAssetActionDeps) {
    return {
        createExperienceAsset: createExperienceAsset(deps),
        getExperienceAssetById: getExperienceAssetById(deps),
        listExperienceAssets: listExperienceAssets(deps),
        listExperienceAssetsByExperience: listExperienceAssetsByExperience(deps),
        updateExperienceAsset: updateExperienceAsset(deps),
        deleteExperienceAsset: deleteExperienceAsset(deps),
    };
}
