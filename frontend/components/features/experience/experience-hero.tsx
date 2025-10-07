import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

interface ExperienceHeroProps {
  id: string
  title: string
  description: string | null
  coverImageUrl: string | null
  location: string | null
  duration: string | null
  experienceType: string
  featured?: string
}

export function ExperienceHero({
  id,
  title,
  description,
  coverImageUrl,
  location,
  duration,
  experienceType,
  featured = "FEATURED / 01"
}: ExperienceHeroProps) {
  const defaultImage = "/placeholder.svg"
  const image = coverImageUrl || defaultImage
  const category = experienceType === 'scheduled' ? '日時指定' : '期間指定'

  return (
    <div className="relative h-[70vh] overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/70" />
      </div>

      <div className="relative h-full flex items-center">
        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="max-w-xl">
            <div className="p-8 bg-black/60 backdrop-blur-sm rounded-lg">
              <div className="text-xs tracking-[0.3em] text-white/90 mb-4 font-mono drop-shadow-2xl">
                {featured}
              </div>
              <h1 className="text-7xl md:text-8xl font-black text-white mb-4 leading-[0.85] tracking-tight drop-shadow-2xl">
                {title}
              </h1>
              {description && (
                <p className="text-lg text-white mb-6 leading-relaxed font-light drop-shadow-2xl line-clamp-3">
                  {description}
                </p>
              )}
              <div className="flex items-center space-x-6 text-white/90 text-sm mb-8 drop-shadow-2xl">
                {location && <span>{location}</span>}
                {location && duration && <span className="w-1 h-1 bg-white/70 rounded-full"></span>}
                {duration && <span>{duration}</span>}
              </div>
              <Link href={`/experiences/${id}`}>
                <Button size="lg" className="bg-white text-black hover:bg-gray-100 font-medium drop-shadow-lg">
                  予約する
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
