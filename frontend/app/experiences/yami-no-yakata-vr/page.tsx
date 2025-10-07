import { Button } from "@/components/ui/button"
import { ArrowLeft, Calendar, MapPin, Users, Clock, Star, Heart, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function YamiNoYakataVRPage() {
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
      <section className="relative h-screen overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/dark-haunted-mansion-vr-horror-experience-with-eer.jpg"
            alt="闇の館VR体験"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/80 to-black/60" />
        </div>

        <div className="relative h-full flex items-end">
          <div className="max-w-7xl mx-auto px-6 pb-24 w-full">
            <div className="max-w-3xl">
              <Link href="/" className="inline-flex items-center text-white/80 hover:text-white mb-6 drop-shadow-2xl">
                <ArrowLeft className="w-5 h-5 mr-2" />
                戻る
              </Link>
              <div className="mb-6">
                <div className="inline-block bg-red-600/90 backdrop-blur-sm px-3 py-1 rounded text-xs tracking-[0.4em] text-white mb-4 font-mono drop-shadow-2xl">
                  FEATURED / 01
                </div>
              </div>
              <h1 className="text-7xl md:text-9xl font-black text-white mb-8 leading-none drop-shadow-[0_8px_32px_rgba(0,0,0,0.8)]">
                闇の館
                <br />
                VR
              </h1>
              <p className="text-2xl text-white/90 mb-12 leading-relaxed drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
                呪われた洋館で繰り広げられる恐怖体験。
                <br />
                あなたは無事に脱出できるか？
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* BEFORE Section - 関連コンテンツ */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="text-xs tracking-[0.3em] text-gray-400 mb-2 font-mono">BEFORE</div>
            <h2 className="text-4xl font-black text-black mb-4">体験前に楽しむ</h2>
            <p className="text-gray-600">闇の館VRへの期待を高める関連コンテンツ</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
            <Link href="#" className="group">
              <div className="relative aspect-[4/5] overflow-hidden mb-4">
                <img
                  src="/dark-haunted-mansion-vr-horror-experience-with-eer.jpg"
                  alt="闇の館の歴史"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="inline-block bg-red-600/90 px-2 py-1 rounded text-xs tracking-[0.3em] text-white mb-2 font-mono drop-shadow-lg">
                    STORY / 01
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2 drop-shadow-xl">館の歴史</h3>
                  <p className="text-white/80 text-sm drop-shadow-lg">100年前の悲劇と呪いの真相</p>
                </div>
              </div>
            </Link>

            <Link href="#" className="group">
              <div className="relative aspect-[4/5] overflow-hidden mb-4">
                <img
                  src="/vr-development-behind-the-scenes.jpg"
                  alt="VR制作の舞台裏"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="inline-block bg-blue-600/90 px-2 py-1 rounded text-xs tracking-[0.3em] text-white mb-2 font-mono drop-shadow-lg">
                    MAKING / 02
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2 drop-shadow-xl">制作秘話</h3>
                  <p className="text-white/80 text-sm drop-shadow-lg">VR恐怖体験の作り方</p>
                </div>
              </div>
            </Link>

            <Link href="#" className="group">
              <div className="relative aspect-[4/5] overflow-hidden mb-4">
                <img
                  src="/person-preparing-for-horror-vr-experience.jpg"
                  alt="ホラー体験の心構え"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="inline-block bg-purple-600/90 px-2 py-1 rounded text-xs tracking-[0.3em] text-white mb-2 font-mono drop-shadow-lg">
                    GUIDE / 03
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2 drop-shadow-xl">体験の心構え</h3>
                  <p className="text-white/80 text-sm drop-shadow-lg">恐怖を楽しむためのコツ</p>
                </div>
              </div>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            <div className="bg-gray-50 p-8 rounded-lg">
              <div className="inline-block bg-gray-800 px-3 py-1 rounded text-xs tracking-[0.3em] text-white mb-4 font-mono">
                COLUMN
              </div>
              <h3 className="text-2xl font-bold text-black mb-4">VR技術で蘇る恐怖</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                最新のVR技術により、従来のホラー体験では不可能だった360度の恐怖を実現。
                空間音響と触覚フィードバックが生み出す、まるで本当にその場にいるような感覚。
              </p>
              <Link href="#" className="text-black hover:underline text-sm font-medium">
                続きを読む →
              </Link>
            </div>

            <div className="bg-gray-50 p-8 rounded-lg">
              <div className="inline-block bg-gray-800 px-3 py-1 rounded text-xs tracking-[0.3em] text-white mb-4 font-mono">
                INTERVIEW
              </div>
              <h3 className="text-2xl font-bold text-black mb-4">開発者インタビュー</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                「本当に怖いVR体験を作りたかった」- 闇の館VRの開発チームが語る、
                恐怖演出へのこだわりと技術的な挑戦について。
              </p>
              <Link href="#" className="text-black hover:underline text-sm font-medium">
                インタビューを見る →
              </Link>
            </div>
          </div>

          <div className="text-center">
            <Link href="/" className="inline-flex items-center text-black hover:underline">
              他の体験も見る
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>
      </section>

      {/* Experience Details */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-16">
            <div className="aspect-[4/5] overflow-hidden">
              <img
                src="/dark-haunted-mansion-vr-horror-experience-with-eer.jpg"
                alt="闇の館VRの世界観"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="space-y-8">
              <div>
                <div className="text-xs tracking-[0.3em] text-gray-400 mb-4 font-mono">EXPERIENCE</div>
                <h3 className="text-3xl font-black text-black mb-6">恐怖の洋館を探索</h3>
                <p className="text-gray-600 leading-relaxed mb-6">
                  最新のVR技術により、まるで本当に呪われた洋館にいるような恐怖体験を提供します。
                  360度音響システムと触覚フィードバックにより、五感すべてで恐怖を感じることができます。
                </p>
                <div className="space-y-4">
                  <div className="flex items-start space-x-4">
                    <div className="w-2 h-2 bg-black rounded-full mt-2 flex-shrink-0" />
                    <p className="text-gray-600">リアルな洋館を忠実に再現したVR空間</p>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="w-2 h-2 bg-black rounded-full mt-2 flex-shrink-0" />
                    <p className="text-gray-600">360度音響システムによる没入感</p>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="w-2 h-2 bg-black rounded-full mt-2 flex-shrink-0" />
                    <p className="text-gray-600">最大4名まで同時体験可能</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-lg font-bold text-black mb-2">45分間の恐怖</h4>
              <p className="text-gray-600 text-sm">準備から体験まで、じっくりと恐怖の世界に浸る</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-lg font-bold text-black mb-2">1-4名対応</h4>
              <p className="text-gray-600 text-sm">一人でも友達とでも、恐怖を分かち合える</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-lg font-bold text-black mb-2">18歳以上推奨</h4>
              <p className="text-gray-600 text-sm">本格的な恐怖体験のため年齢制限あり</p>
            </div>
          </div>
        </div>
      </section>

      {/* Booking Section */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-black text-black mb-8">体験を予約する</h2>
          <div className="bg-gray-50 p-8 rounded-lg mb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-left">
              <div>
                <div className="flex items-center space-x-2 text-gray-600 mb-2">
                  <MapPin className="w-5 h-5" />
                  <span className="text-sm">場所</span>
                </div>
                <p className="font-semibold text-black">渋谷VRパーク</p>
              </div>
              <div>
                <div className="flex items-center space-x-2 text-gray-600 mb-2">
                  <Clock className="w-5 h-5" />
                  <span className="text-sm">所要時間</span>
                </div>
                <p className="font-semibold text-black">45分</p>
              </div>
              <div>
                <div className="flex items-center space-x-2 text-gray-600 mb-2">
                  <Users className="w-5 h-5" />
                  <span className="text-sm">定員</span>
                </div>
                <p className="font-semibold text-black">1-4名</p>
              </div>
              <div>
                <div className="flex items-center space-x-2 text-gray-600 mb-2">
                  <Calendar className="w-5 h-5" />
                  <span className="text-sm">料金</span>
                </div>
                <p className="font-semibold text-black">¥6,800</p>
              </div>
            </div>
          </div>
          <Link href="/book/yami-no-yakata-vr">
            <Button size="lg" className="bg-black text-white hover:bg-gray-800 px-12">
              今すぐ予約する
            </Button>
          </Link>
        </div>
      </section>

      {/* AFTER Section */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="text-xs tracking-[0.3em] text-gray-400 mb-2 font-mono">AFTER</div>
            <h2 className="text-4xl font-black text-black mb-4">体験後の余韻</h2>
            <p className="text-gray-600">恐怖を分かち合い、記憶を刻む</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div>
                <h3 className="text-2xl font-bold text-black mb-4">体験者の声</h3>
                <div className="space-y-6">
                  <div className="border-l-4 border-black pl-6">
                    <p className="text-gray-600 mb-2">
                      "本当に洋館にいるような感覚で、心臓が止まるかと思いました。
                      友達と一緒だったから最後まで体験できたけど、一人だったら絶対無理..."
                    </p>
                    <p className="text-sm text-gray-500">— 田中さん (24歳)</p>
                  </div>
                  <div className="border-l-4 border-black pl-6">
                    <p className="text-gray-600 mb-2">
                      "VRの技術がここまで進歩しているとは。本当にあの館にいるような感覚で、
                      終わった後もしばらく現実に戻れませんでした。"
                    </p>
                    <p className="text-sm text-gray-500">— 佐藤さん (28歳)</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-bold text-black mb-4">体験後の特典</h4>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Heart className="w-5 h-5 text-black" />
                    <span className="text-gray-600">限定フォトスポットでの記念撮影</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Heart className="w-5 h-5 text-black" />
                    <span className="text-gray-600">体験証明書の発行</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Heart className="w-5 h-5 text-black" />
                    <span className="text-gray-600">次回割引クーポン</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="aspect-[4/5] overflow-hidden">
              <img
                src="/community-interaction-art-gallery-people-discussin.jpg"
                alt="体験後の記念撮影"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
