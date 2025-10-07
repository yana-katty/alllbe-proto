'use client'

import { Header } from "@/components/shared/header"
import { Footer } from "@/components/shared/footer"
import { Button } from "@/components/ui/button"
import { ArrowRight, Calendar, MapPin, Users, Clock, Star, Heart } from "lucide-react"
import Link from "next/link"
import { trpc } from "@/lib/trpc"
import { LoadingSpinner } from "@/components/shared/loading"
import { notFound } from "next/navigation"
import { ExperienceContent } from "@/components/features/experience/experience-content"
import { useExperienceAccessLevel } from "@/hooks/use-experience-access-level"

export default function ExperienceDetailPage({ params }: { params: { id: string } }) {
  // tRPC で Experience 詳細を取得
  const { data: experience, isLoading, error } = trpc.experience.getById.useQuery(params.id)

  // ユーザーのアクセスレベルを取得
  const { accessLevel } = useExperienceAccessLevel(params.id)

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

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section */}
      <section className="relative h-screen overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt={experience.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
        </div>

        <div className="relative h-full flex items-end pb-20">
          <div className="max-w-7xl mx-auto px-6 w-full">
            <div className="max-w-2xl">
              <div className="text-xs tracking-[0.3em] text-white/90 mb-4 font-mono">
                {experience.experienceType === 'scheduled' ? '日時指定' : '期間指定'}
              </div>
              <h1 className="text-7xl md:text-8xl font-black text-white mb-6 leading-[0.9] tracking-tight">
                {experience.title}
              </h1>
              {experience.description && (
                <p className="text-xl text-white mb-8 leading-relaxed font-light">
                  {experience.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-6 text-white/90 text-sm mb-10">
                {experience.location && (
                  <div className="flex items-center">
                    <MapPin className="w-5 h-5 mr-2" />
                    {experience.location}
                  </div>
                )}
                {experience.duration && (
                  <div className="flex items-center">
                    <Clock className="w-5 h-5 mr-2" />
                    {experience.duration}
                  </div>
                )}
                {experience.maxParticipants && (
                  <div className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    最大{experience.maxParticipants}名
                  </div>
                )}
                {experience.price && (
                  <div className="text-2xl font-bold">
                    {experience.price}
                  </div>
                )}
              </div>
              <Link href={`/book/${experience.id}`}>
                <Button size="lg" className="bg-white text-black hover:bg-gray-100 font-medium">
                  予約する
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Details Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
            {/* Main Content */}
            <div className="lg:col-span-2">
              {/* Description */}
              <div className="mb-16">
                <div className="text-xs tracking-[0.3em] text-gray-400 mb-4 font-mono">
                  ABOUT
                </div>
                <h2 className="text-4xl font-bold text-black mb-6">体験について</h2>
                <p className="text-gray-600 leading-relaxed text-lg whitespace-pre-line">
                  {experience.description}
                </p>
              </div>

              {/* Highlights */}
              {experience.highlights && typeof experience.highlights === 'string' && (() => {
                try {
                  const highlights = JSON.parse(experience.highlights) as string[]
                  return highlights.length > 0 ? (
                    <div className="mb-16">
                      <div className="text-xs tracking-[0.3em] text-gray-400 mb-4 font-mono">
                        HIGHLIGHTS
                      </div>
                      <h2 className="text-4xl font-bold text-black mb-6">ポイント</h2>
                      <div className="space-y-4">
                        {highlights.map((highlight: string, index: number) => (
                          <div key={index} className="flex items-start space-x-4">
                            <Star className="w-6 h-6 text-black mt-1 flex-shrink-0" />
                            <p className="text-gray-600 text-lg">{highlight}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null
                } catch {
                  return null
                }
              })()}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <div className="bg-gray-50 p-8 rounded-lg">
                  <h3 className="text-2xl font-bold mb-6">予約情報</h3>

                  <div className="space-y-4 mb-8">
                    {experience.duration && (
                      <div className="flex justify-between items-center py-3 border-b border-gray-200">
                        <span className="text-gray-600">体験時間</span>
                        <span className="font-medium">{experience.duration}</span>
                      </div>
                    )}
                    {experience.location && (
                      <div className="flex justify-between items-center py-3 border-b border-gray-200">
                        <span className="text-gray-600">場所</span>
                        <span className="font-medium">{experience.location}</span>
                      </div>
                    )}
                    {experience.maxParticipants && (
                      <div className="flex justify-between items-center py-3 border-b border-gray-200">
                        <span className="text-gray-600">定員</span>
                        <span className="font-medium">最大{experience.maxParticipants}名</span>
                      </div>
                    )}
                    {experience.price && (
                      <div className="flex justify-between items-center py-3">
                        <span className="text-gray-600">料金</span>
                        <span className="text-2xl font-bold">
                          ¥{experience.price.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <Link href={`/book/${experience.id}`}>
                    <Button size="lg" className="w-full bg-black text-white hover:bg-gray-800">
                      予約する
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Related Content Section */}
      <ExperienceContent
        experienceId={experience.id}
        userAccessLevel={accessLevel}
      />

      <Footer />
    </div>
  )
}
