import { Button } from "@/components/ui/button"
import { CheckCircle, Calendar, MapPin, Mail } from "lucide-react"
import Link from "next/link"

export default function CompletePage({ params }: { params: { experienceId: string } }) {
  // 実際の実装では、予約IDやデータをAPIから取得
  const bookingId = "BK" + Math.random().toString(36).substr(2, 8).toUpperCase()

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

      {/* Success Section */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="mb-12">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <div className="text-xs tracking-[0.3em] text-gray-400 mb-4 font-mono">BOOKING COMPLETE</div>
            <h1 className="text-5xl font-bold text-black mb-6">予約が完了しました</h1>
            <p className="text-xl text-gray-600 mb-8">
              ご予約ありがとうございます。確認メールをお送りしましたので、ご確認ください。
            </p>
            <div className="inline-block bg-gray-100 px-6 py-3 rounded-lg">
              <span className="text-sm text-gray-600">予約番号: </span>
              <span className="font-mono font-bold text-black">{bookingId}</span>
            </div>
          </div>

          {/* Booking Summary */}
          <div className="max-w-2xl mx-auto mb-12">
            <div className="bg-gray-50 p-8 rounded-lg text-left">
              <h2 className="text-2xl font-bold text-black mb-6 text-center">予約内容</h2>

              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-black mb-1">闇の館VR</h3>
                    <p className="text-gray-600">恐怖のVR体験 - 45分間</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-6 h-6 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-black mb-1">日時</h3>
                    <p className="text-gray-600">2024年12月15日（日）14:00開始</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-black mb-1">場所</h3>
                    <p className="text-gray-600">渋谷VRパーク</p>
                    <p className="text-sm text-gray-500 mt-1">〒150-0042 東京都渋谷区宇田川町21-6</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Important Information */}
          <div className="max-w-2xl mx-auto mb-12">
            <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
              <h3 className="font-bold text-black mb-4">当日のご案内</h3>
              <ul className="text-left text-gray-700 space-y-2">
                <li>• 開始時刻の10分前までにお越しください</li>
                <li>• お支払いは現地にて承ります（現金・クレジットカード可）</li>
                <li>• 身分証明書をお持ちください</li>
                <li>• 動きやすい服装でお越しください</li>
              </ul>
            </div>
          </div>

          {/* Next Steps */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/">
                <Button size="lg" variant="outline" className="bg-transparent">
                  トップページに戻る
                </Button>
              </Link>
              <Link href="/experiences/yami-no-yakata-vr">
                <Button size="lg" className="bg-black text-white hover:bg-gray-800">
                  体験詳細を見る
                </Button>
              </Link>
            </div>

            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
              <Mail className="w-4 h-4" />
              <span>確認メールが届かない場合は、迷惑メールフォルダをご確認ください</span>
            </div>
          </div>
        </div>
      </section>

      {/* Related Experiences */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-black mb-4">他の体験もチェック</h2>
            <p className="text-gray-600">さらなる冒険があなたを待っています</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "廃校の謎",
                category: "HORROR",
                image: "/abandoned-school-at-night-horror-atmosphere-with-d.jpg",
                location: "新宿ミステリーハウス",
              },
              {
                title: "深夜の美術館",
                category: "MYSTERY",
                image: "/mysterious-museum-at-night-with-ancient-artifacts-.jpg",
                location: "上野国立美術館",
              },
              {
                title: "宇宙ステーション",
                category: "SCI-FI",
                image: "/placeholder-5mvav.png",
                location: "品川VRパーク",
              },
            ].map((experience, index) => (
              <div key={index} className="group cursor-pointer">
                <div className="aspect-[4/3] overflow-hidden rounded-lg mb-4">
                  <img
                    src={experience.image || "/placeholder.svg"}
                    alt={experience.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="text-xs tracking-[0.3em] text-gray-400 mb-2 font-mono">{experience.category}</div>
                <h3 className="text-xl font-bold text-black mb-2">{experience.title}</h3>
                <p className="text-gray-600 text-sm">{experience.location}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
