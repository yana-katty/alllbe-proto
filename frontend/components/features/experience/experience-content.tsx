'use client';

import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, FileText, Image, Video, Download, Music, Lock, CheckCircle2 } from 'lucide-react';
import { LoadingSpinner } from '@/components/shared/loading';

interface ExperienceContentProps {
    experienceId: string;
    userAccessLevel?: 'public' | 'ticket_holder' | 'attended';
}

const assetTypeIcons = {
    video: Video,
    article: FileText,
    image: Image,
    download: Download,
    audio: Music,
};

const categoryLabels = {
    story: 'ストーリー',
    making: 'メイキング',
    guide: '体験ガイド',
    column: 'コラム',
    interview: 'インタビュー',
    other: 'その他',
};

const accessLevelLabels = {
    public: '誰でも閲覧可能',
    ticket_holder: 'チケット購入者限定',
    attended: '体験済み限定',
};

const accessLevelIcons = {
    public: CheckCircle2,
    ticket_holder: Lock,
    attended: Lock,
};

export function ExperienceContent({ experienceId, userAccessLevel = 'public' }: ExperienceContentProps) {
    // Before コンテンツの取得
    const { data: beforeAssets, isLoading: beforeLoading, error: beforeError } = trpc.experienceAsset.listByExperience.useQuery({
        experienceId,
        contentTiming: 'before',
        limit: 50,
    });

    // After コンテンツの取得
    const { data: afterAssets, isLoading: afterLoading, error: afterError } = trpc.experienceAsset.listByExperience.useQuery({
        experienceId,
        contentTiming: 'after',
        limit: 50,
    });

    // アクセス可能かどうかを判定
    const canAccess = (requiredLevel: 'public' | 'ticket_holder' | 'attended'): boolean => {
        const levels = ['public', 'ticket_holder', 'attended'];
        const userLevelIndex = levels.indexOf(userAccessLevel);
        const requiredLevelIndex = levels.indexOf(requiredLevel);
        return userLevelIndex >= requiredLevelIndex;
    };

    // アセットカードコンポーネント
    const AssetCard = ({ asset }: { asset: any }) => {
        const accessible = canAccess(asset.accessLevel);
        const Icon = assetTypeIcons[asset.assetType as keyof typeof assetTypeIcons];
        const AccessIcon = accessLevelIcons[asset.accessLevel as keyof typeof accessLevelIcons];

        return (
            <Card className={`transition-all ${accessible ? 'hover:shadow-lg cursor-pointer' : 'opacity-60'}`}>
                <CardHeader className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg text-black line-clamp-2">{asset.title}</CardTitle>
                        <Icon className="h-5 w-5 text-gray-500 flex-shrink-0" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {asset.category && (
                            <Badge variant="secondary" className="text-xs">
                                {categoryLabels[asset.category as keyof typeof categoryLabels] || asset.category}
                            </Badge>
                        )}
                        <Badge
                            variant={accessible ? 'outline' : 'default'}
                            className="text-xs flex items-center gap-1"
                        >
                            <AccessIcon className="h-3 w-3" />
                            {accessLevelLabels[asset.accessLevel as keyof typeof accessLevelLabels]}
                        </Badge>
                    </div>
                </CardHeader>
                {asset.description && (
                    <CardContent>
                        <CardDescription className="line-clamp-3 text-gray-600">
                            {asset.description}
                        </CardDescription>
                        {!accessible && (
                            <p className="mt-4 text-sm text-gray-500">
                                🔒 このコンテンツを閲覧するには
                                {asset.accessLevel === 'ticket_holder' && 'チケットの購入が必要です'}
                                {asset.accessLevel === 'attended' && '体験への参加が必要です'}
                            </p>
                        )}
                        {accessible && asset.duration && (
                            <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                                <Clock className="h-4 w-4" />
                                <span>{asset.duration}</span>
                            </div>
                        )}
                    </CardContent>
                )}
            </Card>
        );
    };

    if (beforeLoading || afterLoading) {
        return (
            <div className="flex justify-center items-center py-20">
                <LoadingSpinner />
            </div>
        );
    }

    if (beforeError || afterError) {
        return (
            <div className="text-center py-20">
                <p className="text-red-600 mb-2">コンテンツの取得に失敗しました</p>
                <p className="text-sm text-muted-foreground">
                    {beforeError?.message || afterError?.message}
                </p>
            </div>
        );
    }

    const hasBeforeContent = beforeAssets && beforeAssets.length > 0;
    const hasAfterContent = afterAssets && afterAssets.length > 0;

    if (!hasBeforeContent && !hasAfterContent) {
        return null; // コンテンツがない場合は何も表示しない
    }

    return (
        <section className="py-16 bg-white">
            <div className="container mx-auto px-4">
                <Tabs defaultValue={hasBeforeContent ? 'before' : 'after'} className="w-full">
                    <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
                        {hasBeforeContent && (
                            <TabsTrigger value="before" className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                体験前コンテンツ
                            </TabsTrigger>
                        )}
                        {hasAfterContent && (
                            <TabsTrigger value="after" className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4" />
                                体験後コンテンツ
                            </TabsTrigger>
                        )}
                    </TabsList>

                    {hasBeforeContent && (
                        <TabsContent value="before" className="mt-8">
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-bold text-black mb-3">体験前コンテンツ</h2>
                                <p className="text-gray-600">
                                    体験をより楽しむための事前情報やストーリーをご覧いただけます
                                </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {beforeAssets.map((asset) => (
                                    <AssetCard key={asset.id} asset={asset} />
                                ))}
                            </div>
                        </TabsContent>
                    )}

                    {hasAfterContent && (
                        <TabsContent value="after" className="mt-8">
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-bold text-black mb-3">体験後コンテンツ</h2>
                                <p className="text-gray-600">
                                    体験者限定の特別コンテンツや振り返りをお届けします
                                </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {afterAssets.map((asset) => (
                                    <AssetCard key={asset.id} asset={asset} />
                                ))}
                            </div>
                        </TabsContent>
                    )}
                </Tabs>
            </div>
        </section>
    );
}
