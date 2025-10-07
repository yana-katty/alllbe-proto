import { Button } from "@/components/ui/button"
import { ArrowRight, Clock, MapPin, Users, Calendar } from "lucide-react"
import Link from "next/link"

// Mock data - 実際の実装では API から取得
const getExperienceData = (id: string) => {
  const experiences = {
    "yami-no-yakata-vr": {
      title: "闇の館VR",
      subtitle: "呪われた洋館で繰り広げられる恐怖体験",
      category: "HORROR / VR",
      duration: "45分",
      location: "渋谷VRパーク",
      maxParticipants: 4,
      image: "/dark-haunted-mansion-vr-horror-experience-with-eer.jpg",
      description: "最新のVR技術を駆使した恐怖体験。呪われた洋館の中で、あなたは生き残ることができるでしょうか？",
      highlights: [
        "最新VR技術による没入感",
        "プロの声優による迫真の演技",
        "複数のエンディング",
        "最大4名まで同時体験可能",
      ],
    },
  }
  return experiences[id as keyof typeof experiences]
}

export default function BookExperiencePage({ params }: { params: { experienceId: string } }) {
  const experience = getExperienceData(params.experienceId)

  if (!experience) {
    return <div>体験が見つかりません</div>
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="text-2xl font-bold text-black">
              i'll be
            </Link>
            <div className="flex items-center space-x-6">
              <Button variant="ghost" size="sm" className="text-black">
                LOGIN
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative">
        <div className="relative h-[60vh] overflow-hidden">
          <div className="absolute inset-0">
            <img
              src={experience.image || "/placeholder.svg"}
              alt={experience.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />
          </div>

          <div className="relative h-full flex items-end">
            <div className="max-w-7xl mx-auto px-6 w-full pb-16">
              <div className="max-w-2xl">
                <div className="text-xs tracking-[0.3em] text-white/90 mb-4 font-mono drop-shadow-2xl">
                  {experience.category}
                </div>
                <h1 className="text-6xl md:text-7xl font-black text-white mb-4 leading-[0.85] tracking-tight drop-shadow-2xl">
                  {experience.title}
                </h1>
                <p className="text-lg text-white mb-6 leading-relaxed font-light drop-shadow-2xl">
                  {experience.subtitle}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Booking Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
            {/* Experience Details */}
            <div className="lg:col-span-2">
              <div className="mb-12">
                <div className="text-xs tracking-[0.3em] text-gray-400 mb-4 font-mono">EXPERIENCE DETAILS</div>
                <h2 className="text-3xl font-bold text-black mb-6">体験について</h2>
                <p className="text-gray-600 leading-relaxed mb-8 text-lg">{experience.description}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-black mb-1">体験時間</h3>
                      <p className="text-gray-600">{experience.duration}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-black mb-1">開催場所</h3>
                      <p className="text-gray-600">{experience.location}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-black mb-1">参加人数</h3>
                      <p className="text-gray-600">最大{experience.maxParticipants}名まで</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-black mb-1">支払い方法</h3>
                      <p className="text-gray-600">現地決済のみ</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-8 rounded-lg">
                  <h3 className="text-xl font-bold text-black mb-4">体験のハイライト</h3>
                  <ul className="space-y-3">
                    {experience.highlights.map((highlight, index) => (
                      <li key={index} className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-black rounded-full"></div>
                        <span className="text-gray-700">{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Booking Card */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <div className="bg-black text-white p-8 rounded-lg">
                  <div className="text-xs tracking-[0.3em] text-white/70 mb-4 font-mono">BOOKING / 01</div>
                  <h3 className="text-2xl font-bold mb-6">予約を開始</h3>

                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between items-center py-3 border-b border-white/20">
                      <span className="text-white/80">体験時間</span>
                      <span className="font-medium">{experience.duration}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-white/20">
                      <span className="text-white/80">場所</span>
                      <span className="font-medium">{experience.location}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-white/20">
                      <span className="text-white/80">支払い</span>
                      <span className="font-medium">現地決済</span>
                    </div>
                  </div>

                  <Link href={`/book/${params.experienceId}/datetime`}>
                    <Button size="lg" className="w-full bg-white text-black hover:bg-gray-100 font-medium">
                      日時を選択する
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>

                  <p className="text-xs text-white/60 mt-4 text-center">予約確定まで料金は発生しません</p>
                </div>

                {/* Additional Info */}
                <div className="mt-8 p-6 bg-gray-50 rounded-lg">
                  <h4 className="font-bold text-black mb-3">ご注意事項</h4>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li>• 13歳未満の方は保護者同伴が必要です</li>
                    <li>• 心臓疾患をお持ちの方はご遠慮ください</li>
                    <li>• 開始時刻の10分前までにお越しください</li>
                    <li>• キャンセルは前日まで可能です</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
