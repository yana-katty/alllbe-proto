/**
 * Experience Actions
 * 
 * Temporal Workflowではない通常の関数として実装
 * 主にRead操作とビジネスロジックを提供し、tRPCから直接呼び出し可能
 * 
 * 依存注入パターンにより、テスト時にActivity関数をモック可能
 * エラーは throw されるため、呼び出し側で try-catch でハンドリング
 */

import type { Experience } from '../activities/db/schema';
import type {
    ExperienceCreateInput,
    ExperienceUpdateInput,
    ExperienceQueryInput,
    InsertExperience,
    FindExperienceById,
    ListExperiences,
    ListExperiencesByBrand,
    UpdateExperience,
    RemoveExperience,
} from '../activities/db/models/experience';
import { ExperienceErrorType, createExperienceError } from '../activities/db/models/experience';

// 依存関数の型定義
interface ExperienceActionDeps {
    insertExperienceActivity: InsertExperience;
    findExperienceByIdActivity: FindExperienceById;
    listExperiencesActivity: ListExperiences;
    listExperiencesByBrandActivity: ListExperiencesByBrand;
    updateExperienceActivity: UpdateExperience;
    removeExperienceActivity: RemoveExperience;
}

/**
 * Experience 作成
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_DATABASE_ERROR) - DB操作エラー
 */
export const createExperience = (deps: Pick<ExperienceActionDeps, 'insertExperienceActivity'>) =>
    async (data: ExperienceCreateInput): Promise<Experience> => {
        return await deps.insertExperienceActivity(data);
    };

/**
 * Experience取得 (ID指定)
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_DATABASE_ERROR) - DB操作エラー
 */
export const getExperienceById = (deps: Pick<ExperienceActionDeps, 'findExperienceByIdActivity'>) =>
    async (id: string): Promise<Experience | null> => {
        return await deps.findExperienceByIdActivity(id);
    };

/**
 * Experience一覧取得（検索条件付き）
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_DATABASE_ERROR) - DB操作エラー
 */
export const listExperiences = (deps: Pick<ExperienceActionDeps, 'listExperiencesActivity'>) =>
    async (params: ExperienceQueryInput): Promise<Experience[]> => {
        return await deps.listExperiencesActivity(params);
    };

/**
 * Brand配下のExperience一覧取得
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_DATABASE_ERROR) - DB操作エラー
 */
export const listExperiencesByBrand = (deps: Pick<ExperienceActionDeps, 'listExperiencesByBrandActivity'>) =>
    async (brandId: string, params?: Partial<ExperienceQueryInput>): Promise<Experience[]> => {
        return await deps.listExperiencesByBrandActivity(brandId, params);
    };

/**
 * Experience更新
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_NOT_FOUND) - Experience が見つからない場合
 * @throws ApplicationFailure (type: EXPERIENCE_DATABASE_ERROR) - DB操作エラー
 */
export const updateExperience = (deps: Pick<ExperienceActionDeps, 'updateExperienceActivity'>) =>
    async (id: string, patch: ExperienceUpdateInput): Promise<Experience> => {
        return await deps.updateExperienceActivity(id, patch);
    };

/**
 * Experience削除（依存関係チェック付き）
 * 
 * TODO: ExperienceAssets等の依存関係チェックを追加予定
 * 
 * @throws ApplicationFailure (type: EXPERIENCE_NOT_FOUND) - Experience が見つからない場合
 * @throws ApplicationFailure (type: EXPERIENCE_DATABASE_ERROR) - DB操作エラー
 */
export const deleteExperience = (deps: Pick<ExperienceActionDeps, 'removeExperienceActivity' | 'findExperienceByIdActivity'>) =>
    async (id: string): Promise<boolean> => {
        // Experience存在チェック
        const experience = await deps.findExperienceByIdActivity(id);
        if (!experience) {
            throw createExperienceError({
                type: ExperienceErrorType.NOT_FOUND,
                message: `Experience not found: ${id}`,
                details: { experienceId: id },
                nonRetryable: true,
            });
        }

        // TODO: ExperienceAssets等の依存関係チェック
        // const hasAssets = await checkExperienceHasAssets(id);
        // if (hasAssets) {
        //     throw createExperienceError({
        //         type: ExperienceErrorType.HAS_DEPENDENCIES,
        //         message: `Cannot delete experience with existing assets: ${id}`,
        //         details: { experienceId: id },
        //         nonRetryable: true,
        //     });
        // }

        return await deps.removeExperienceActivity(id);
    };

/**
 * Experience Actions ファクトリ
 * 全てのAction関数を依存注入で生成
 * 
 * @param deps - Experience Activity関数の依存
 * @returns すべてのExperience Action関数
 */
export function createExperienceActions(deps: ExperienceActionDeps) {
    return {
        createExperience: createExperience(deps),
        getExperienceById: getExperienceById(deps),
        listExperiences: listExperiences(deps),
        listExperiencesByBrand: listExperiencesByBrand(deps),
        updateExperience: updateExperience(deps),
        deleteExperience: deleteExperience(deps),
    };
}
