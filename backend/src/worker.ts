/**
 * Temporal Worker - E2E Testing用
 * 
 * Workflow と Activity を実行する Worker プロセス。
 * Temporal Server に接続し、タスクキューから処理を取得して実行する。
 */

import { Worker, NativeConnection } from '@temporalio/worker';
import { initializeTemporalRuntime } from './workflows/logger';
import { getDatabase } from './activities/db/connection';
import * as organizationModel from './activities/db/models/organization';
import * as brandModel from './activities/db/models/brand';
import * as bookingModel from './activities/db/models/booking';
import * as paymentModel from './activities/db/models/payment';

async function run() {
    // Temporal Runtime Logger の初期化
    initializeTemporalRuntime();

    // データベース接続の取得
    const db = getDatabase();

    // Activities の構築（依存注入）
    const activities = {
        // Organization Activities
        ...organizationModel.createOrganizationActivities(db),

        // Brand Activities
        insertBrand: brandModel.insertBrand(db),
        findBrandById: brandModel.findBrandById(db),
        findBrandsByOrganizationId: brandModel.findBrandsByOrganizationId(db),
        findDefaultBrandByOrganizationId: brandModel.findDefaultBrandByOrganizationId(db),
        updateBrand: brandModel.updateBrand(db),
        deleteBrand: brandModel.deleteBrand(db),
        countBrandsByOrganizationId: brandModel.countBrandsByOrganizationId(db),

        // Booking Activities
        insertBooking: bookingModel.insertBooking(db),
        findBookingById: bookingModel.findBookingById(db),
        findBookingByQrCode: bookingModel.findBookingByQrCode(db),
        updateBooking: bookingModel.updateBooking(db),
        listBookingsByUser: bookingModel.listBookingsByUser(db),
        listBookingsByExperience: bookingModel.listBookingsByExperience(db),
        listAttendedBookingsByUser: bookingModel.listAttendedBookingsByUser(db),
        hasUserAttendedExperience: bookingModel.hasUserAttendedExperience(db),

        // Payment Activities
        insertPayment: paymentModel.insertPayment(db),
        findPaymentById: paymentModel.findPaymentById(db),
        findPaymentByBookingId: paymentModel.findPaymentByBookingId(db),
        updatePayment: paymentModel.updatePayment(db),
        completePayment: paymentModel.completePayment(db),
        refundPayment: paymentModel.refundPayment(db),
    };

    // Temporal Server への接続
    const connection = await NativeConnection.connect({
        address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    });

    // Worker の作成
    const worker = await Worker.create({
        connection,
        namespace: 'default',
        taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'main',
        workflowsPath: require.resolve('./workflows'),
        activities,
    });

    console.log('Temporal Worker started successfully');
    console.log(`  Task Queue: ${process.env.TEMPORAL_TASK_QUEUE || 'main'}`);
    console.log(`  Temporal Address: ${process.env.TEMPORAL_ADDRESS || 'localhost:7233'}`);

    // Worker の実行
    await worker.run();
}

run().catch((err) => {
    console.error('Failed to start Temporal Worker:', err);
    process.exit(1);
});
