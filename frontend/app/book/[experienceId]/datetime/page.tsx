'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { ArrowLeft, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format, parseISO, isSameDay, addDays, startOfDay } from 'date-fns';
import { ja } from 'date-fns/locale';

export default function DateTimePage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const experienceId = params.experienceId as string;
    const participants = parseInt(searchParams.get('participants') || '1', 10);

    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);

    // Experience データ取得
    const { data: experience, isLoading } = trpc.experience.getById.useQuery(experienceId);

    // 利用可能な日付を計算
    const availableDates = useMemo(() => {
        if (!experience) return [];

        const dates: Date[] = [];
        const today = startOfDay(new Date());

        if (experience.experienceType === 'scheduled') {
            // 日時指定型: 開始日を追加
            if (experience.scheduledStartAt) {
                const sessionDate = startOfDay(parseISO(experience.scheduledStartAt));
                if (sessionDate >= today) {
                    dates.push(sessionDate);
                }
            }
        } else if (experience.experienceType === 'period') {
            // 期間指定型: 開始日から終了日までの全日程
            if (experience.periodStartDate && experience.periodEndDate) {
                const startDate = startOfDay(parseISO(experience.periodStartDate));
                const endDate = startOfDay(parseISO(experience.periodEndDate));

                let currentDate = startDate > today ? startDate : today;
                while (currentDate <= endDate) {
                    dates.push(currentDate);
                    currentDate = addDays(currentDate, 1);
                }
            }
        }

        return dates.sort((a, b) => a.getTime() - b.getTime());
    }, [experience]);

    // 選択された日付の利用可能な時間帯を計算
    const availableTimeSlots = useMemo(() => {
        if (!experience || !selectedDate) return [];

        interface TimeSlot {
            id: string;
            startTime: string;
            endTime: string;
            availableCapacity: number;
            maxCapacity: number;
        }

        if (experience.experienceType === 'scheduled') {
            // 日時指定型: 選択日が開始日と一致する場合のみ
            if (
                experience.scheduledStartAt &&
                experience.scheduledEndAt &&
                isSameDay(parseISO(experience.scheduledStartAt), selectedDate)
            ) {
                return [
                    {
                        id: experience.id,
                        startTime: format(parseISO(experience.scheduledStartAt), 'HH:mm', { locale: ja }),
                        endTime: format(parseISO(experience.scheduledEndAt), 'HH:mm', { locale: ja }),
                        availableCapacity: 100, // 仮の値（実際はBooking数から計算）
                        maxCapacity: 100,
                    },
                ];
            }
            return [];
        } else if (experience.experienceType === 'period') {
            // 期間指定型: 営業時間のスロット（仮の実装）
            const slots: TimeSlot[] = [];
            for (let hour = 10; hour <= 18; hour++) {
                slots.push({
                    id: `${format(selectedDate, 'yyyy-MM-dd')}-${hour}:00`,
                    startTime: `${hour}:00`,
                    endTime: `${hour + 1}:00`,
                    availableCapacity: 100,
                    maxCapacity: 100,
                });
            }
            return slots.filter((slot) => slot.availableCapacity >= participants);
        }

        return [];
    }, [experience, selectedDate, participants]);

    const handleDateSelect = (date: Date | undefined) => {
        setSelectedDate(date);
        setSelectedTimeSlot(null); // 日付変更時は時間選択をリセット
    };

    const handleTimeSlotSelect = (slotId: string) => {
        setSelectedTimeSlot(slotId);
    };

    const handleContinue = () => {
        if (!selectedDate || !selectedTimeSlot) return;

        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        router.push(
            `/book/${experienceId}/confirm?participants=${participants}&date=${dateStr}&timeSlot=${selectedTimeSlot}`
        );
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">読み込み中...</p>
                </div>
            </div>
        );
    }

    if (!experience) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Card className="max-w-md">
                    <CardHeader>
                        <CardTitle>エラー</CardTitle>
                        <CardDescription>体験が見つかりませんでした</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => router.push('/discover')} className="w-full">
                            体験を探す
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="container max-w-4xl mx-auto px-4">
                {/* ヘッダー */}
                <div className="mb-6">
                    <Button variant="ghost" onClick={() => router.back()} className="mb-4">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        戻る
                    </Button>
                    <h1 className="text-3xl font-bold mb-2">{experience.title}</h1>
                    <p className="text-muted-foreground">
                        参加人数: {participants}名 | 日時を選択してください
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* 日付選択カード */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CalendarIcon className="h-5 w-5" />
                                日付を選択
                            </CardTitle>
                            <CardDescription>
                                {experience.experienceType === 'scheduled'
                                    ? '利用可能な日程から選択してください'
                                    : '期間内の日付を選択してください'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={handleDateSelect}
                                disabled={(date) => {
                                    const today = startOfDay(new Date());
                                    if (date < today) return true;
                                    return !availableDates.some((d) => isSameDay(d, date));
                                }}
                                locale={ja}
                                className="rounded-md border"
                            />
                        </CardContent>
                    </Card>

                    {/* 時間帯選択カード */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5" />
                                時間帯を選択
                            </CardTitle>
                            <CardDescription>
                                {selectedDate
                                    ? `${format(selectedDate, 'M月d日（E）', { locale: ja })}の利用可能な時間帯`
                                    : '日付を選択してください'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!selectedDate ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                    <p>まず日付を選択してください</p>
                                </div>
                            ) : availableTimeSlots.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <p>この日付には利用可能な時間帯がありません</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {availableTimeSlots.map((slot) => (
                                        <button
                                            key={slot.id}
                                            onClick={() => handleTimeSlotSelect(slot.id)}
                                            className={`w-full p-4 rounded-lg border-2 text-left transition-all ${selectedTimeSlot === slot.id
                                                    ? 'border-primary bg-primary/5'
                                                    : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="font-semibold">
                                                        {slot.startTime} - {slot.endTime}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        残り {slot.availableCapacity} 枠 / {slot.maxCapacity} 枠
                                                    </p>
                                                </div>
                                                {selectedTimeSlot === slot.id && (
                                                    <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                                                        <svg
                                                            className="h-4 w-4 text-white"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M5 13l4 4L19 7"
                                                            />
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* 続行ボタン */}
                <div className="mt-6">
                    <Button
                        onClick={handleContinue}
                        disabled={!selectedDate || !selectedTimeSlot}
                        className="w-full md:w-auto md:px-8"
                        size="lg"
                    >
                        予約内容の確認へ進む
                    </Button>
                </div>
            </div>
        </div>
    );
}
