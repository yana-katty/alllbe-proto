import { ExperienceCard } from "./experience-card"

interface Experience {
  id: string
  title: string
  category: string
  image: string
  location?: string
  duration?: string
  subtitle?: string
}

interface ExperienceGridProps {
  experiences: Experience[]
  columns?: 1 | 2 | 3 | 4
}

export function ExperienceGrid({ experiences, columns = 3 }: ExperienceGridProps) {
  const gridClass = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
  }[columns]

  return (
    <div className={`grid ${gridClass} gap-8`}>
      {experiences.map((experience) => (
        <ExperienceCard key={experience.id} {...experience} />
      ))}
    </div>
  )
}
