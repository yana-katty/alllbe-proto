import { Header } from "@/components/shared/header"
import { Footer } from "@/components/shared/footer"
import { Button } from "@/components/ui/button"
import { ArrowRight, Calendar, MapPin, Users, Clock, Star, Heart } from "lucide-react"
import Link from "next/link"
import { getExperienceById } from "@/lib/constants"
import { notFound } from "next/navigation"

export default function ExperienceDetailPage({ params }: { params: { id: string } }) {
  const experience = getExperienceById(params.id)

  if (!experience) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section */}
      <section className="relative h-screen overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={experience.image}
            alt={experience.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
        </div>

        <div className="relative h-full flex items-end pb-20">
          <div className="max-w-7xl mx-auto px-6 w-full">
            <div className="max-w-2xl">
              <div className="text-xs tracking-[0.3em] text-white/90 mb-4 font-mono">
                {experience.category}
              </div>
              <h1 className="text-7xl md:text-8xl font-black text-white mb-6 leading-[0.9] tracking-tight">
                {experience.title}
              </h1>
              <p className="text-xl text-white mb-8 leading-relaxed font-light">
                {experience.subtitle}
              </p>
              <div className="flex flex-wrap items-center gap-6 text-white/90 text-sm mb-10">
                <div className="flex items-center">
                  <MapPin className="w-5 h-5 mr-2" />
                  {experience.location}
                </div>
                <div className="flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  {experience.duration}
                </div>
                {experience.maxParticipants && (
                  <div className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    最大{experience.maxParticipants}名
                  </div>
                )}
                {experience.price && (
                  <div className="text-2xl font-bold">
                    ¥{experience.price.toLocaleString()}
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
                <p className="text-gray-600 leading-relaxed text-lg">
                  {experience.description || experience.subtitle}
                </p>
              </div>

              {/* Highlights */}
              {experience.highlights && experience.highlights.length > 0 && (
                <div className="mb-16">
                  <div className="text-xs tracking-[0.3em] text-gray-400 mb-4 font-mono">
                    HIGHLIGHTS
                  </div>
                  <h2 className="text-4xl font-bold text-black mb-6">ポイント</h2>
                  <div className="space-y-4">
                    {experience.highlights.map((highlight, index) => (
                      <div key={index} className="flex items-start space-x-4">
                        <Star className="w-6 h-6 text-black mt-1 flex-shrink-0" />
                        <p className="text-gray-600 text-lg">{highlight}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Before Content */}
              {experience.beforeContent && experience.beforeContent.length > 0 && (
                <div className="mb-16">
                  <div className="text-xs tracking-[0.3em] text-gray-400 mb-4 font-mono">
                    BEFORE EXPERIENCE
                  </div>
                  <h2 className="text-4xl font-bold text-black mb-6">
                    体験前に楽しめるコンテンツ
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {experience.beforeContent.map((content, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-6">
                        <h3 className="font-bold text-lg mb-2">{content.title}</h3>
                        {content.description && (
                          <p className="text-gray-600 text-sm">{content.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <div className="bg-gray-50 p-8 rounded-lg">
                  <h3 className="text-2xl font-bold mb-6">予約情報</h3>
                  
                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between items-center py-3 border-b border-gray-200">
                      <span className="text-gray-600">体験時間</span>
                      <span className="font-medium">{experience.duration}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-gray-200">
                      <span className="text-gray-600">場所</span>
                      <span className="font-medium">{experience.location}</span>
                    </div>
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

      {/* After Experience Preview */}
      {experience.afterContent && experience.afterContent.length > 0 && (
        <section className="py-20 bg-black text-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <div className="text-xs tracking-[0.3em] text-white/70 mb-4 font-mono">
                AFTER EXPERIENCE
              </div>
              <h2 className="text-5xl font-bold mb-6">体験後のお楽しみ</h2>
              <p className="text-white/80 text-lg max-w-2xl mx-auto">
                体験後も楽しめる特別コンテンツをご用意しています
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {experience.afterContent.map((content, index) => (
                <div key={index} className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
                  <Heart className="w-8 h-8 mb-4" />
                  <h3 className="text-xl font-bold mb-2">{content.title}</h3>
                  {content.description && (
                    <p className="text-white/70">{content.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  )
}
