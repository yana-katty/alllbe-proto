import Link from "next/link"
import { Clock, MapPin } from "lucide-react"
import Image from "next/image"

interface ExperienceCardProps {
  id: string
  title: string
  description: string | null
  coverImageUrl: string | null
  location: string | null
  duration: string | null
  price: string | null
  experienceType: string
  featured?: boolean
}

export function ExperienceCard({
  id,
  title,
  description,
  coverImageUrl,
  location,
  duration,
  price,
  experienceType,
  featured = false
}: ExperienceCardProps) {
  // デフォルト画像とカテゴリマッピング
  const defaultImage = "/placeholder.svg"
  const image = coverImageUrl || defaultImage
  const category = experienceType === 'scheduled' ? '日時指定' : '期間指定'

  if (featured) {
    return (
      <Link href={`/experiences/${id}`}>
        <div className="relative aspect-[4/5] overflow-hidden group cursor-pointer">
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-black/40" />

          <div className="absolute inset-0 flex flex-col justify-between p-8">
            <div>
              <div className="inline-block bg-white/10 backdrop-blur-sm px-3 py-1 rounded text-xs tracking-[0.3em] text-white mb-4 font-mono">
                {category}
              </div>
            </div>

            <div className="p-6 bg-black/60 backdrop-blur-sm rounded-lg">
              <h3 className="text-4xl md:text-5xl font-black mb-4 leading-[0.9] tracking-tight text-white drop-shadow-2xl">
                {title}
              </h3>
              {description && (
                <p className="text-lg text-white mb-6 leading-relaxed max-w-md drop-shadow-lg line-clamp-2">
                  {description}
                </p>
              )}
              <div className="flex items-center space-x-4 text-sm text-white drop-shadow-lg">
                {location && (
                  <>
                    <span className="flex items-center">
                      <MapPin className="w-4 h-4 mr-1" />
                      {location}
                    </span>
                  </>
                )}
                {duration && (
                  <>
                    {location && <span>•</span>}
                    <span className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {duration}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link href={`/experiences/${id}`}>
      <div className="group cursor-pointer">
        <div className="aspect-[4/5] overflow-hidden mb-4 rounded-lg">
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
        <div className="text-xs tracking-[0.3em] text-gray-400 mb-2 font-mono uppercase">
          {category}
        </div>
        <h3 className="text-2xl font-bold mb-2 text-black">{title}</h3>
        {description && <p className="text-gray-600 text-sm mb-3 line-clamp-2">{description}</p>}
        <div className="flex items-center space-x-3 text-xs text-gray-500">
          {location && (
            <span className="flex items-center">
              <MapPin className="w-3 h-3 mr-1" />
              {location}
            </span>
          )}
          {duration && (
            <>
              {location && <span>•</span>}
              <span className="flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                {duration}
              </span>
            </>
          )}
          {price && (
            <>
              {(location || duration) && <span>•</span>}
              <span className="font-medium text-black">{price}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}
