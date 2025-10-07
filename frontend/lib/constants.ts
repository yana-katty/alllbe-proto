// Mock Experience データ型定義
export interface Experience {
  id: string
  title: string
  subtitle: string
  category: string
  image: string
  location: string
  duration: string
  maxParticipants?: number
  price?: number
  description?: string
  highlights?: string[]
  beforeContent?: {
    type: string
    title: string
    description?: string
  }[]
  afterContent?: {
    type: string
    title: string
    description?: string
  }[]
}

// Mock Experiences データ
export const MOCK_EXPERIENCES: Experience[] = [
  {
    id: "yami-no-yakata-vr",
    title: "闇の館VR",
    subtitle: "呪われた洋館で繰り広げられる恐怖体験",
    category: "HORROR / VR",
    image: "/dark-haunted-mansion-vr-horror-experience-with-eer.jpg",
    location: "渋谷VRパーク",
    duration: "45分",
    maxParticipants: 4,
    price: 6800,
    description: "VR技術を駆使した最恐のホラー体験。あなたは呪われた洋館から脱出できるか？",
    highlights: [
      "最新VR技術による圧倒的没入感",
      "恐怖と謎解きが融合した体験",
      "4人までの協力プレイ可能"
    ]
  },
  {
    id: "kyojin-senki",
    title: "巨神戦記",
    subtitle: "巨大な神々との壮大な戦い",
    category: "IMMERSIVE / THEATER",
    image: "/giant-warriors-battle-immersive-theater-experience.jpg",
    location: "お台場",
    duration: "90分",
    maxParticipants: 20,
    price: 12000
  },
  {
    id: "mahou-no-meikyuu",
    title: "魔法の迷宮",
    subtitle: "魔法の力で謎を解き明かせ",
    category: "IMMERSIVE / THEATER",
    image: "/magical-fantasy-maze-with-glowing-portals-and-myst.jpg",
    location: "銀座",
    duration: "120分",
    maxParticipants: 15,
    price: 15000
  },
  {
    id: "neon-city",
    title: "ネオン・シティ",
    subtitle: "未来都市を駆け抜けるVR体験",
    category: "VR / DIGITAL",
    image: "/futuristic-neon-cyberpunk-city-vr-experience-with-.jpg",
    location: "秋葉原",
    duration: "60分",
    maxParticipants: 2,
    price: 8500
  },
  {
    id: "haikou-no-nazo",
    title: "廃校の謎",
    subtitle: "閉鎖された学校に隠された秘密",
    category: "HORROR / MYSTERY",
    image: "/abandoned-school-at-night-horror-atmosphere-with-d.jpg",
    location: "新宿ミステリーハウス",
    duration: "60分",
    maxParticipants: 6,
    price: 7500
  },
  {
    id: "shinya-no-bijutsukan",
    title: "深夜の美術館",
    subtitle: "特別ナイトツアー",
    category: "MYSTERY",
    image: "/mysterious-museum-at-night-with-ancient-artifacts-.jpg",
    location: "上野国立美術館",
    duration: "90分",
    maxParticipants: 10,
    price: 9800
  }
]

// カテゴリー別のExperienceを取得
export function getExperiencesByCategory(category: string): Experience[] {
  return MOCK_EXPERIENCES.filter(exp => 
    exp.category.toLowerCase().includes(category.toLowerCase())
  )
}

// IDでExperienceを取得
export function getExperienceById(id: string): Experience | undefined {
  return MOCK_EXPERIENCES.find(exp => exp.id === id)
}

// Featured Experiencesを取得
export function getFeaturedExperiences(limit: number = 4): Experience[] {
  return MOCK_EXPERIENCES.slice(0, limit)
}
