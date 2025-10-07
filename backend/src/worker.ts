/**
 * Temporal Worker - E2E Testing用
 * 
 * Workflow と Activity を実行する Worker プロセス。
 * Temporal Server に接続し、タスクキューから処理を取得して実行する。
 */

import { Worker, NativeConnection } from '@temporalio/worker';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { initializeTemporalRuntime } from './workflows/logger';
import { getDatabase } from './activities/db/connection';

// DB Models
import * as organizationModel from './activities/db/models/organization';
import * as brandModel from './activities/db/models/brand';
import * as experienceModel from './activities/db/models/experience';
import * as experienceAssetsModel from './activities/db/models/experienceAssets';
import * as bookingModel from './activities/db/models/booking';
import * as paymentModel from './activities/db/models/payment';
import * as userModel from './activities/db/models/user';

// Auth Activities
import * as auth0Activities from './activities/auth/auth0';
import * as workosActivities from './activities/auth/workos';

// 環境変数の読み込み
config();

// ESM対応: __dirname の取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
    // Temporal Runtime Logger の初期化
    initializeTemporalRuntime();

    // データベース接続の取得
    const db = getDatabase();

    // Auth0 Client の作成
    const auth0Config = auth0Activities.getAuth0ConfigFromEnv();
    const auth0Client = auth0Activities.createAuth0ManagementClient(auth0Config);

    // WorkOS Client の作成
    const workosConfig = workosActivities.getWorkosConfigFromEnv();
    const workosClient = workosActivities.createWorkosClient(workosConfig);

    // Activities の構築（依存注入）
    const activities = {
        // ============================================
        // Organization Activities
        // ============================================
        ...organizationModel.createOrganizationActivities(db),

        // ============================================
        // Brand Activities
        // ============================================
        insertBrand: brandModel.insertBrand(db),
        findBrandById: brandModel.findBrandById(db),
        findBrandsByOrganizationId: brandModel.findBrandsByOrganizationId(db),
        findDefaultBrandByOrganizationId: brandModel.findDefaultBrandByOrganizationId(db),
        updateBrand: brandModel.updateBrand(db),
        deleteBrand: brandModel.deleteBrand(db),
        countBrandsByOrganizationId: brandModel.countBrandsByOrganizationId(db),

        // ============================================
        // Experience Activities
        // ============================================
        insertExperience: experienceModel.insertExperience(db),
        findExperienceById: experienceModel.findExperienceById(db),
        listExperiences: experienceModel.listExperiences(db),
        listExperiencesByBrand: experienceModel.listExperiencesByBrand(db),
        updateExperience: experienceModel.updateExperience(db),
        removeExperience: experienceModel.removeExperience(db),

        // ============================================
        // Experience Assets Activities
        // ============================================
        insertExperienceAsset: experienceAssetsModel.insertExperienceAsset(db),
        findExperienceAssetById: experienceAssetsModel.findExperienceAssetById(db),
        listExperienceAssets: experienceAssetsModel.listExperienceAssets(db),
        listExperienceAssetsByExperience: experienceAssetsModel.listExperienceAssetsByExperience(db),
        updateExperienceAsset: experienceAssetsModel.updateExperienceAsset(db),
        removeExperienceAsset: experienceAssetsModel.removeExperienceAsset(db),

        // ============================================
        // Booking Activities
        // ============================================
        insertBooking: bookingModel.insertBooking(db),
        findBookingById: bookingModel.findBookingById(db),
        findBookingByQrCode: bookingModel.findBookingByQrCode(db),
        updateBooking: bookingModel.updateBooking(db),
        listBookingsByUser: bookingModel.listBookingsByUser(db),
        listBookingsByExperience: bookingModel.listBookingsByExperience(db),
        listAttendedBookingsByUser: bookingModel.listAttendedBookingsByUser(db),
        hasUserAttendedExperience: bookingModel.hasUserAttendedExperience(db),

        // ============================================
        // Payment Activities
        // ============================================
        insertPayment: paymentModel.insertPayment(db),
        findPaymentById: paymentModel.findPaymentById(db),
        findPaymentByBookingId: paymentModel.findPaymentByBookingId(db),
        updatePayment: paymentModel.updatePayment(db),
        completePayment: paymentModel.completePayment(db),
        refundPayment: paymentModel.refundPayment(db),

        // ============================================
        // User Activities
        // ============================================
        insertUser: userModel.insertUser(db),
        findUserById: userModel.findUserById(db),
        updateUser: userModel.updateUser(db),
        removeUser: userModel.removeUser(db),
        listUsers: userModel.listUsers(db),

        // ============================================
        // Auth0 Activities
        // ============================================
        getAuth0User: auth0Activities.getAuth0User(auth0Client),
        getAuth0UserSummary: auth0Activities.getAuth0UserSummary(auth0Client),
        createAuth0User: auth0Activities.createAuth0User(auth0Client, auth0Config.connectionName),
        updateAuth0User: auth0Activities.updateAuth0User(auth0Client),
        deleteAuth0User: auth0Activities.deleteAuth0User(auth0Client),
        updateAuth0EmailVerification: auth0Activities.updateAuth0EmailVerification(auth0Client),
        blockAuth0User: auth0Activities.blockAuth0User(auth0Client),

        // ============================================
        // WorkOS Activities
        // ============================================
        // Organization
        getWorkosOrganization: workosActivities.getWorkosOrganization(workosClient),
        getWorkosOrganizationSummary: workosActivities.getWorkosOrganizationSummary(workosClient),
        createWorkosOrganization: workosActivities.createWorkosOrganization(workosClient),
        updateWorkosOrganization: workosActivities.updateWorkosOrganization(workosClient),
        deleteWorkosOrganization: workosActivities.deleteWorkosOrganization(workosClient),
        listWorkosOrganizations: workosActivities.listWorkosOrganizations(workosClient),

        // User
        getWorkosOrganizationUser: workosActivities.getWorkosOrganizationUser(workosClient),
        getWorkosUserSummary: workosActivities.getWorkosUserSummary(workosClient),
        createWorkosUser: workosActivities.createWorkosUser(workosClient),
        createWorkosOrganizationMembership: workosActivities.createWorkosOrganizationMembership(workosClient),
        updateWorkosUser: workosActivities.updateWorkosUser(workosClient),
        deleteWorkosUser: workosActivities.deleteWorkosUser(workosClient),
        listWorkosOrganizationUsers: workosActivities.listWorkosOrganizationUsers(workosClient),
        checkWorkosOrganizationMembership: workosActivities.checkWorkosOrganizationMembership(workosClient),
        deleteWorkosOrganizationMembership: workosActivities.deleteWorkosOrganizationMembership(workosClient),
    };

    // Temporal Server への接続
    const temporalAddress = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
    const temporalNamespace = process.env.TEMPORAL_NAMESPACE || 'default';
    const temporalApiKey = process.env.TEMPORAL_API_KEY;

    // Temporal Cloud用のTLS設定
    const connectionOptions: Parameters<typeof NativeConnection.connect>[0] = {
        address: temporalAddress,
    };

    // API Keyが設定されている場合はTemporal Cloud接続（TLS有効）
    if (temporalApiKey) {
        connectionOptions.tls = {}; // 空オブジェクトでデフォルトTLS有効化
        connectionOptions.apiKey = temporalApiKey;
    }

    const connection = await NativeConnection.connect(connectionOptions);

    // Worker の作成
    const worker = await Worker.create({
        connection,
        namespace: temporalNamespace,
        taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'main',
        workflowsPath: resolve(__dirname, 'workflows'),
        activities,
    });

    console.log('Temporal Worker started successfully');
    console.log(`  Task Queue: ${process.env.TEMPORAL_TASK_QUEUE || 'main'}`);
    console.log(`  Temporal Address: ${temporalAddress}`);
    console.log(`  Temporal Namespace: ${temporalNamespace}`);
    console.log(`  Temporal Cloud: ${temporalApiKey ? 'Enabled (API Key)' : 'Disabled (Local)'}`);
    console.log(`  Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
    console.log(`  Auth0: ${auth0Config.domain ? 'Configured' : 'Not configured'}`);
    console.log(`  WorkOS: ${workosConfig.apiKey ? 'Configured' : 'Not configured'}`);

    // Worker の実行
    await worker.run();
}

run().catch((err) => {
    console.error('Failed to start Temporal Worker:', err);
    process.exit(1);
});
