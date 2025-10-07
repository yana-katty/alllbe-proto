import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Header } from "@/components/shared/header"
import { Footer } from "@/components/shared/footer"
import {
  Calendar,
  Clock,
  MapPin,
  ChevronRight,
  Play,
  BookOpen,
  ImageIcon,
  Film,
  Music,
  FileText,
  Palette,
} from "lucide-react"

export default function MyExperiencesPage() {
  // Mock data - 実際にはAPIから取得
  const upcomingExperience = {
    id: "yami-no-yakata-vr",
    title: "闇の館VR",
    category: "HORROR / VR",
    image: "/dark-haunted-mansion-vr-horror-experience-with-eer.jpg",
    date: "2025年10月15日",
    time: "19:00",
    location: "渋谷VRパーク",
    daysUntil: 6,
    beforeContent: [
      { type: "article", title: "館の背景ストーリー", duration: "5分" },
      { type: "video", title: "VR制作の舞台裏", duration: "12分" },
      { type: "guide", title: "体験の心構えガイド", duration: "8分" },
    ],
  }

  const pastExperiences = [
    {
      id: "neon-city",
      title: "ネオン・シティ",
      category: "FUTURE / VR",
      image: "/futuristic-neon-cyberpunk-city-vr-experience-with-.jpg",
      date: "2025年9月20日",
      rating: 5,
      afterContent: [
        { type: "artwork", title: "コンセプトアート集", count: 32, icon: Palette },
        { type: "story", title: "後日談：ネオンの向こう側", duration: "15分", icon: BookOpen },
        { type: "document", title: "世界観設定資料", pages: 24, icon: FileText },
        { type: "video", title: "メイキング映像", duration: "28分", icon: Film },
        { type: "music", title: "サウンドトラック", tracks: 12, icon: Music },
      ],
    },
    {
      id: "magical-maze",
      title: "魔法の迷宮",
      category: "IMMERSIVE / THEATER",
      image: "/magical-fantasy-maze-with-glowing-portals-and-myst.jpg",
      date: "2025年8月10日",
      rating: 4,
      afterContent: [
        { type: "artwork", title: "キャラクターデザイン集", count: 18, icon: Palette },
        { type: "story", title: "隠された物語", duration: "12分", icon: BookOpen },
        { type: "document", title: "魔法体系の秘密", pages: 16, icon: FileText },
        { type: "video", title: "舞台裏ドキュメンタリー", duration: "22分", icon: Film },
      ],
    },
    {
      id: "giant-warriors",
      title: "巨神戦記",
      category: "IMMERSIVE / THEATER",
      image: "/giant-warriors-battle-immersive-theater-experience.jpg",
      date: "2025年7月5日",
      rating: 5,
      afterContent: [
        { type: "artwork", title: "巨神デザイン資料", count: 28, icon: Palette },
        { type: "story", title: "戦いの記録", duration: "18分", icon: BookOpen },
        { type: "document", title: "古代文明の謎", pages: 20, icon: FileText },
        { type: "music", title: "戦闘BGM集", tracks: 8, icon: Music },
      ],
    },
    {
      id: "abandoned-school",
      title: "廃校の謎",
      category: "HORROR / MYSTERY",
      image: "/abandoned-school-at-night-horror-atmosphere-with-d.jpg",
      date: "2025年6月12日",
      rating: 4,
      afterContent: [
        { type: "story", title: "真相解明編", duration: "20分", icon: BookOpen },
        { type: "document", title: "事件の全貌", pages: 18, icon: FileText },
        { type: "video", title: "制作秘話", duration: "15分", icon: Film },
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section - Next Experience */}
      <section className="relative h-[70vh] min-h-[600px] overflow-hidden">
        <Image
          src={upcomingExperience.image || "/placeholder.svg"}
          alt={upcomingExperience.title}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />

        <div className="relative h-full max-w-7xl mx-auto px-6 flex items-center">
          <div className="max-w-2xl space-y-8">
            <div className="space-y-4">
              <Badge className="bg-red-600 text-white px-4 py-1.5 text-sm font-medium">NEXT EXPERIENCE</Badge>
              <p className="text-white/80 text-sm tracking-[0.2em] uppercase">{upcomingExperience.category}</p>
              <h1 className="text-7xl font-bold text-white leading-tight drop-shadow-2xl">
                {upcomingExperience.title}
              </h1>
            </div>

            <div className="flex items-center gap-6 text-white/90">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <span className="text-lg">{upcomingExperience.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span className="text-lg">{upcomingExperience.time}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                <span className="text-lg">{upcomingExperience.location}</span>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg p-6">
              <p className="text-white text-2xl font-bold mb-2">あと{upcomingExperience.daysUntil}日</p>
              <p className="text-white/80">体験まで楽しみにお待ちください</p>
            </div>

            <div className="flex gap-4">
              <Button size="lg" className="bg-white text-black hover:bg-gray-100 px-8">
                予約詳細を見る
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white/10 px-8 bg-transparent"
              >
                キャンセル・変更
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Before Content Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-12">
            <p className="text-sm tracking-[0.2em] uppercase text-gray-500 mb-2">BEFORE</p>
            <h2 className="text-4xl font-bold mb-4">体験前に楽しむ</h2>
            <p className="text-gray-600 text-lg">{upcomingExperience.title}への期待を高める関連コンテンツ</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {upcomingExperience.beforeContent.map((content, index) => (
              <Link
                key={index}
                href={`/experiences/${upcomingExperience.id}/before/${index}`}
                className="group relative overflow-hidden rounded-lg bg-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="aspect-[4/3] relative overflow-hidden bg-gradient-to-br from-gray-900 to-gray-700">
                  <div className="absolute inset-0 flex items-center justify-center">
                    {content.type === "article" && <BookOpen className="w-16 h-16 text-white/30" />}
                    {content.type === "video" && <Play className="w-16 h-16 text-white/30" />}
                    {content.type === "guide" && <ImageIcon className="w-16 h-16 text-white/30" />}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30">
                      {content.type === "article" && "記事"}
                      {content.type === "video" && "動画"}
                      {content.type === "guide" && "ガイド"}
                    </Badge>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2 group-hover:text-red-600 transition-colors">{content.title}</h3>
                  <p className="text-gray-500 text-sm">{content.duration}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Past Experiences Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-12">
            <p className="text-sm tracking-[0.2em] uppercase text-gray-500 mb-2">HISTORY</p>
            <h2 className="text-4xl font-bold mb-4">過去の体験</h2>
            <p className="text-gray-600 text-lg">体験後のお楽しみコンテンツをチェック</p>
          </div>

          <div className="space-y-8">
            {pastExperiences.map((experience) => (
              <div
                key={experience.id}
                className="group relative overflow-hidden rounded-lg bg-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="grid md:grid-cols-2 gap-0">
                  {/* Image */}
                  <div className="relative aspect-[16/10] md:aspect-auto overflow-hidden">
                    <Image
                      src={experience.image || "/placeholder.svg"}
                      alt={experience.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />
                    <div className="absolute top-6 left-6">
                      <Badge className="bg-black/60 backdrop-blur-sm text-white border-white/30 px-3 py-1">
                        {experience.category}
                      </Badge>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-8 flex flex-col justify-between">
                    <div>
                      <h3 className="text-3xl font-bold mb-4">{experience.title}</h3>
                      <p className="text-gray-500 mb-6">{experience.date}</p>

                      <div className="flex gap-1 mb-8">
                        {[...Array(5)].map((_, i) => (
                          <svg
                            key={i}
                            className={`w-6 h-6 ${
                              i < experience.rating ? "text-yellow-400 fill-current" : "text-gray-300"
                            }`}
                            viewBox="0 0 20 20"
                          >
                            <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                          </svg>
                        ))}
                      </div>

                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-500 mb-3">AFTER - 体験後のお楽しみ</p>
                      </div>

                      <div className="space-y-3">
                        {experience.afterContent.map((content, index) => {
                          const Icon = content.icon
                          return (
                            <Link
                              key={index}
                              href={`/experiences/${experience.id}/after/${content.type}/${index}`}
                              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group/item"
                            >
                              <div className="flex items-center gap-3">
                                <Icon className="w-5 h-5 text-gray-600" />
                                <div>
                                  <p className="font-medium">{content.title}</p>
                                  <p className="text-sm text-gray-500">
                                    {content.count && `${content.count}点`}
                                    {content.duration && content.duration}
                                    {content.pages && `${content.pages}ページ`}
                                    {content.tracks && `${content.tracks}曲`}
                                  </p>
                                </div>
                              </div>
                              <ChevronRight className="w-5 h-5 text-gray-400 group-hover/item:text-gray-600 group-hover/item:translate-x-1 transition-all" />
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Discover More Section */}
      <section className="py-20 bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-6">次の体験を探す</h2>
          <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">新しい世界、新しい冒険があなたを待っています</p>
          <Button size="lg" className="bg-white text-black hover:bg-gray-100 px-12">
            体験を探す
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  )
}
