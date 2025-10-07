import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { Header } from "@/components/shared/header"
import { Footer } from "@/components/shared/footer"
import { ExperienceHero } from "@/components/features/experience/experience-hero"
import { ExperienceCard } from "@/components/features/experience/experience-card"
import { MOCK_EXPERIENCES, getFeaturedExperiences } from "@/lib/constants"

export default function HomePage() {
  const featuredExperiences = getFeaturedExperiences(4)
  const mainFeatured = featuredExperiences[0]
  const secondaryFeatured = featuredExperiences.slice(1)

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <section className="relative">
        {/* Main Featured Content */}
        <ExperienceHero
          id={mainFeatured.id}
          title={mainFeatured.title}
          subtitle={mainFeatured.subtitle}
          category={mainFeatured.category}
          image={mainFeatured.image}
          location={mainFeatured.location}
          duration={mainFeatured.duration}
        />

        {/* Secondary Featured Grid */}
        <div className="bg-black text-white py-16">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {secondaryFeatured.map((experience, index) => (
                <ExperienceCard
                  key={experience.id}
                  {...experience}
                  featured={true}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          {/* Horror & Mystery Section */}
          <div className="mb-32">
            <div className="flex items-end justify-between mb-16">
              <div>
                <div className="text-xs tracking-[0.3em] text-gray-400 mb-2 font-mono">CATEGORY / 01</div>
                <h2 className="text-6xl font-black text-black leading-none">
                  HORROR &<br />
                  MYSTERY
                </h2>
              </div>
              <div className="text-right">
                <p className="text-gray-600 mb-2">恐怖と謎解きの世界へ</p>
                <Link href="/category/horror" className="text-sm underline text-black hover:no-underline">
                  すべて見る →
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16">
              {/* Large featured item with overlay */}
              <div className="lg:col-span-8">
                <div className="relative aspect-[16/10] overflow-hidden group cursor-pointer">
                  <img
                    src="/abandoned-school-at-night-horror-atmosphere-with-d.jpg"
                    alt="廃校の謎"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-black/40" />

                  {/* Text overlay with background */}
                  <div className="absolute inset-0 flex flex-col justify-between p-8">
                    <div>
                      <div className="inline-block bg-red-600/90 px-3 py-1 rounded text-xs tracking-[0.4em] text-white mb-4 font-mono drop-shadow-lg">
                        HORROR / 01
                      </div>
                    </div>

                    <div className="p-6 bg-black/60 backdrop-blur-sm rounded-lg">
                      <h3 className="text-5xl md:text-6xl font-black mb-4 leading-[0.9] tracking-tight text-white drop-shadow-2xl">
                        廃校の
                        <br />謎
                      </h3>
                      <p className="text-lg text-white mb-6 leading-relaxed max-w-md drop-shadow-lg">
                        閉鎖された学校に隠された秘密。
                        <br />
                        真実を解き明かせるか？
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-white drop-shadow-lg">
                        <span>新宿ミステリーハウス</span>
                        <span>•</span>
                        <span>60分</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Side content with overlays */}
              <div className="lg:col-span-4 space-y-8">
                <div className="relative group cursor-pointer">
                  <div className="aspect-[4/3] overflow-hidden">
                    <img
                      src="/mysterious-museum-at-night-with-ancient-artifacts-.jpg"
                      alt="深夜の美術館"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />

                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <div className="p-4 bg-black/60 backdrop-blur-sm rounded-lg">
                        <div className="inline-block bg-blue-600/90 px-2 py-1 rounded text-xs tracking-[0.3em] text-white mb-2 font-mono drop-shadow-lg">
                          MYSTERY / 02
                        </div>
                        <h4 className="text-2xl font-bold mb-2 text-white drop-shadow-xl">深夜の美術館</h4>
                        <p className="text-white mb-2 text-sm drop-shadow-xl">特別ナイトツアー</p>
                        <p className="text-white text-xs drop-shadow-xl">上野国立美術館 • 90分</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative group cursor-pointer">
                  <div className="aspect-[4/3] overflow-hidden">
                    <img
                      src="/placeholder-5mvav.png"
                      alt="宇宙ステーション"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />

                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <div className="p-4 bg-black/60 backdrop-blur-sm rounded-lg">
                        <div className="inline-block bg-purple-600/90 px-2 py-1 rounded text-xs tracking-[0.3em] text-white mb-2 font-mono drop-shadow-lg">
                          SCI-FI / 03
                        </div>
                        <h4 className="text-2xl font-bold mb-2 text-white drop-shadow-xl">宇宙ステーション</h4>
                        <p className="text-white mb-2 text-sm drop-shadow-xl">VR探索体験</p>
                        <p className="text-white text-xs drop-shadow-xl">品川VRパーク • 45分</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* VR & Digital Section */}
          <div className="mb-32">
            <div className="flex items-end justify-between mb-16">
              <div>
                <div className="text-xs tracking-[0.3em] text-gray-400 mb-2 font-mono">CATEGORY / 02</div>
                <h2 className="text-6xl font-black text-black leading-none">
                  VR &<br />
                  DIGITAL
                </h2>
              </div>
              <div className="text-right">
                <p className="text-gray-600 mb-2">仮想現実の最前線</p>
                <Link href="/category/vr" className="text-sm underline text-black hover:no-underline">
                  すべて見る →
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  title: "古代遺跡探検",
                  subtitle: "VRアドベンチャー",
                  location: "池袋VRワールド",
                  category: "ADVENTURE / 01",
                  color: "text-orange-400",
                  image: "/placeholder-fdw2y.png",
                },
                {
                  title: "未来都市",
                  subtitle: "VR体験",
                  location: "渋谷VRパーク",
                  category: "FUTURE / 02",
                  color: "text-cyan-400",
                  image: "/placeholder-won6k.png",
                },
                {
                  title: "深海探索",
                  subtitle: "VRダイビング",
                  location: "お台場VRゾーン",
                  category: "OCEAN / 03",
                  color: "text-blue-400",
                  image: "/placeholder-nnev5.png",
                },
                {
                  title: "宇宙飛行",
                  subtitle: "VRシミュレーター",
                  location: "新宿VRセンター",
                  category: "SPACE / 04",
                  color: "text-purple-400",
                  image: "/placeholder-hc0o9.png",
                },
              ].map((item, index) => (
                <div key={index} className="relative group cursor-pointer">
                  <div className="aspect-[3/4] overflow-hidden">
                    <img
                      src={item.image || "/placeholder.svg"}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/98 via-black/70 to-black/30" />
                  </div>

                  <div className="absolute inset-0 flex flex-col justify-between p-6">
                    <div>
                      <div
                        className={`inline-block ${item.color === "text-orange-400" ? "bg-orange-600/90" : item.color === "text-cyan-400" ? "bg-cyan-600/90" : item.color === "text-blue-400" ? "bg-blue-600/90" : "bg-purple-600/90"} px-2 py-1 rounded text-xs tracking-[0.3em] text-white mb-2 font-mono drop-shadow-lg`}
                      >
                        {item.category}
                      </div>
                    </div>

                    <div className="p-4 bg-black/90 backdrop-blur-sm rounded-lg">
                      <h4 className="text-xl font-bold mb-2 text-white drop-shadow-2xl">{item.title}</h4>
                      <p className="text-white mb-2 text-sm drop-shadow-2xl">{item.subtitle}</p>
                      <p className="text-white text-xs drop-shadow-2xl">{item.location}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Immersive Theater Section */}
          <div>
            <div className="flex items-end justify-between mb-16">
              <div>
                <div className="text-xs tracking-[0.3em] text-gray-400 mb-2 font-mono">CATEGORY / 03</div>
                <h2 className="text-6xl font-black text-black leading-none">
                  IMMERSIVE
                  <br />
                  THEATER
                </h2>
              </div>
              <div className="text-right">
                <p className="text-gray-600 mb-2">没入型エンターテイメント</p>
                <Link href="/category/theater" className="text-sm underline text-black hover:no-underline">
                  すべて見る →
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="order-2 lg:order-1">
                <div className="text-xs tracking-[0.3em] text-yellow-600 mb-4 font-mono">THEATER / 01</div>
                <h3 className="text-4xl font-bold text-black mb-6">
                  闇夜の
                  <br />
                  シアター
                </h3>
                <p className="text-gray-600 leading-relaxed mb-8">
                  完全な暗闇の中で繰り広げられる革新的な演劇体験。 視覚以外の感覚を研ぎ澄まし、新たな物語の世界へ。
                </p>
                <div className="flex items-center space-x-4 text-sm text-gray-500 mb-8">
                  <span>恵比寿ガーデンプレイス</span>
                  <span>•</span>
                  <span>150分</span>
                </div>
                <Button className="bg-black text-white hover:bg-gray-800">
                  体験を予約する
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
              <div className="order-1 lg:order-2 relative">
                <div className="aspect-[4/5] overflow-hidden group cursor-pointer">
                  <img
                    src="/dark-immersive-theater-experience-with-dramatic-st.jpg"
                    alt="闇夜のシアター"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  <div className="absolute top-8 left-8">
                    <div className="text-xs tracking-[0.3em] text-yellow-700 font-mono">PREMIUM EXPERIENCE</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
