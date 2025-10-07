'use client'

import { Header } from "@/components/shared/header"
import { Footer } from "@/components/shared/footer"
import { Button } from "@/components/ui/button"
import { ArrowRight, Clock, MapPin, Users, CreditCard } from "lucide-react"
import Link from "next/link"
import { trpc } from "@/lib/trpc"
import { LoadingSpinner } from "@/components/shared/loading"
import { notFound } from "next/navigation"

export default function BookExperiencePage({ params }: { params: { experienceId: string } }) {
  // tRPC で Experience 詳細を取得
  const { data: experience, isLoading, error } = trpc.experience.getById.useQuery(params.experienceId)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="flex justify-center items-center py-40">
          <LoadingSpinner />
        </div>
        <Footer />
      </div>
    )
  }

  if (error || !experience) {
    return notFound()
  }

  const defaultImage = "/placeholder.svg"
  const heroImage = experience.heroImageUrl || experience.coverImageUrl || defaultImage
  const experienceTypeLabel = experience.experienceType === 'scheduled' ? '日時指定' : '期間指定'

  // highlights を JSON からパース
  let highlights: string[] = []
  if (experience.highlights && typeof experience.highlights === 'string') {
    try {
      highlights = JSON.parse(experience.highlights)
    } catch {
      highlights = []
    }
  }

  // paymentMethods を JSON からパース
  let paymentMethods: string[] = ['onsite']
  if (experience.paymentMethods && typeof experience.paymentMethods === 'string') {
    try {
      paymentMethods = JSON.parse(experience.paymentMethods)
    } catch {
      paymentMethods = ['onsite']
    }
  }

  const paymentMethodLabels: Record<string, string> = {
    onsite: '現地決済',
    online: 'オンライン決済',
    both: '現地・オンライン決済'
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section */}
      <section className="relative">
        <div className="relative h-[60vh] overflow-hidden">
          <div className="absolute inset-0">
            <img
              src={heroImage}
              alt={experience.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />
          </div>

          <div className="relative h-full flex items-end">
            <div className="max-w-7xl mx-auto px-6 w-full pb-16">
              <div className="max-w-2xl">
                <div className="text-xs tracking-[0.3em] text-white/90 mb-4 font-mono drop-shadow-2xl">
                  {experienceTypeLabel}
                </div>
                <h1 className="text-6xl md:text-7xl font-black text-white mb-4 leading-[0.85] tracking-tight drop-shadow-2xl">
                  {experience.title}
                </h1>
                {experience.description && (
                  <p className="text-lg text-white mb-6 leading-relaxed font-light drop-shadow-2xl">
                    {experience.description}
                  </p>
                )}
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
                {experience.description && (
                  <p className="text-gray-600 leading-relaxed mb-8 text-lg whitespace-pre-line">
                    {experience.description}
                  </p>
                )}

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

                  {experience.maxParticipants && (
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-black mb-1">参加人数</h3>
                        <p className="text-gray-600">最大{experience.maxParticipants}名まで</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center">
                      <CreditCard className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-black mb-1">支払い方法</h3>
                      <p className="text-gray-600">
                        {paymentMethods.map(m => paymentMethodLabels[m] || m).join('・')}
                      </p>
                    </div>
                  </div>
                </div>

                {highlights.length > 0 && (
                  <div className="bg-gray-50 p-8 rounded-lg">
                    <h3 className="text-xl font-bold text-black mb-4">体験のハイライト</h3>
                    <ul className="space-y-3">
                      {highlights.map((highlight, index) => (
                        <li key={index} className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-black rounded-full"></div>
                          <span className="text-gray-700">{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Booking Card */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <div className="bg-black text-white p-8 rounded-lg">
                  <div className="text-xs tracking-[0.3em] text-white/70 mb-4 font-mono">BOOKING / 01</div>
                  <h3 className="text-2xl font-bold mb-6">予約を開始</h3>

                  <div className="space-y-4 mb-8">
                    {experience.duration && (
                      <div className="flex justify-between items-center py-3 border-b border-white/20">
                        <span className="text-white/80">体験時間</span>
                        <span className="font-medium">{experience.duration}</span>
                      </div>
                    )}
                    {experience.location && (
                      <div className="flex justify-between items-center py-3 border-b border-white/20">
                        <span className="text-white/80">場所</span>
                        <span className="font-medium">{experience.location}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center py-3 border-b border-white/20">
                      <span className="text-white/80">支払い</span>
                      <span className="font-medium">
                        {paymentMethods.map(m => paymentMethodLabels[m] || m).join('・')}
                      </span>
                    </div>
                    {experience.price && (
                      <div className="flex justify-between items-center py-3">
                        <span className="text-white/80">料金</span>
                        <span className="text-2xl font-bold">{experience.price}</span>
                      </div>
                    )}
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
                <div className="mt-6 p-6 bg-gray-50 rounded-lg">
                  <h4 className="font-bold text-black mb-3">キャンセルポリシー</h4>
                  <p className="text-sm text-gray-600">
                    体験開始の48時間前まで無料でキャンセル可能です。
                  </p>
                </div>

                {experience.ageRestriction && (
                  <div className="mt-4 p-6 bg-gray-50 rounded-lg">
                    <h4 className="font-bold text-black mb-3">年齢制限</h4>
                    <p className="text-sm text-gray-600">
                      {experience.ageRestriction}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
