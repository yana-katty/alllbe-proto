import { Header } from "@/components/shared/header"
import { Footer } from "@/components/shared/footer"
import { ExperienceGrid } from "@/components/features/experience/experience-grid"
import { MOCK_EXPERIENCES } from "@/lib/constants"
import { Button } from "@/components/ui/button"

export default function DiscoverPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          {/* Page Header */}
          <div className="mb-12">
            <div className="text-xs tracking-[0.3em] text-gray-400 mb-4 font-mono">
              DISCOVER
            </div>
            <h1 className="text-6xl font-black text-black mb-6 leading-none">
              体験を
              <br />
              探す
            </h1>
            <p className="text-gray-600 text-lg max-w-2xl">
              あなたにぴったりの体験を見つけよう。
              <br />
              ホラー、VR、没入型演劇など、多彩なエンターテイメントが待っています。
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-12">
            <Button variant="outline" className="border-black text-black">
              すべて
            </Button>
            <Button variant="ghost">ホラー・ミステリー</Button>
            <Button variant="ghost">VR・デジタル</Button>
            <Button variant="ghost">没入型演劇</Button>
            <Button variant="ghost">アドベンチャー</Button>
          </div>

          {/* Experience Grid */}
          <ExperienceGrid experiences={MOCK_EXPERIENCES} columns={3} />

          {/* Load More */}
          <div className="mt-16 text-center">
            <Button variant="outline" size="lg" className="border-black text-black">
              さらに読み込む
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
