import { Button } from "@/components/ui/button"
import Link from "next/link"

export function Header() {
  return (
    <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="text-2xl font-bold text-black">
            i'll be
          </Link>
          <div className="flex items-center space-x-6">
            <Link href="/discover">
              <Button variant="ghost" size="sm" className="text-black">
                体験を探す
              </Button>
            </Link>
            <Link href="/my-experiences">
              <Button variant="ghost" size="sm" className="text-black">
                マイページ
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button variant="ghost" size="sm" className="text-black">
                LOGIN
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
