"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight, ArrowLeft, CheckCircle, Calendar, Clock, User, Mail, Phone, Users } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

export default function ConfirmPage({ params }: { params: { experienceId: string } }) {
  const searchParams = useSearchParams()
  const bookingData = {
    date: searchParams.get("date") || "",
    time: searchParams.get("time") || "",
    name: searchParams.get("name") || "",
    email: searchParams.get("email") || "",
    phone: searchParams.get("phone") || "",
    participants: Number.parseInt(searchParams.get("participants") || "1"),
    specialRequests: searchParams.get("specialRequests") || "",
  }

  const handleConfirm = () => {
    // 実際の実装では、ここでAPIに予約データを送信
    window.location.href = `/book/${params.experienceId}/complete`
  }

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

      {/* Progress Bar */}
      <div className="bg-gray-100 py-4">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                ✓
              </div>
              <span className="text-sm font-medium">日時選択</span>
            </div>
            <div className="flex-1 h-px bg-gray-300"></div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                ✓
              </div>
              <span className="text-sm font-medium">参加者情報</span>
            </div>
            <div className="flex-1 h-px bg-gray-300"></div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-sm font-bold">
                3
              </div>
              <span className="text-sm font-medium">確認</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="mb-12">
            <div className="text-xs tracking-[0.3em] text-gray-400 mb-4 font-mono">STEP 03</div>
            <h1 className="text-4xl font-bold text-black mb-4">予約内容をご確認ください</h1>
            <p className="text-gray-600">内容に間違いがなければ、予約を確定してください。</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Confirmation Details */}
            <div className="lg:col-span-2">
              <div className="space-y-8">
                {/* Experience Details */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h2 className="text-xl font-bold text-black mb-4">体験内容</h2>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium">闇の館VR</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Calendar className="w-5 h-5 text-gray-600" />
                      <span>
                        {new Date(bookingData.date).toLocaleDateString("ja-JP", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          weekday: "long",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Clock className="w-5 h-5 text-gray-600" />
                      <span>{bookingData.time} 開始（45分間）</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Users className="w-5 h-5 text-gray-600" />
                      <span>{bookingData.participants}名</span>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h2 className="text-xl font-bold text-black mb-4">代表者情報</h2>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <User className="w-5 h-5 text-gray-600" />
                      <span>{bookingData.name}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Mail className="w-5 h-5 text-gray-600" />
                      <span>{bookingData.email}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Phone className="w-5 h-5 text-gray-600" />
                      <span>{bookingData.phone}</span>
                    </div>
                  </div>
                </div>

                {/* Special Requests */}
                {bookingData.specialRequests && (
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <h2 className="text-xl font-bold text-black mb-4">特別なご要望</h2>
                    <p className="text-gray-700">{bookingData.specialRequests}</p>
                  </div>
                )}

                {/* Payment Information */}
                <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
                  <h2 className="text-xl font-bold text-black mb-4">お支払いについて</h2>
                  <div className="space-y-2">
                    <p className="text-gray-700">• お支払いは当日現地にて承ります</p>
                    <p className="text-gray-700">• 現金またはクレジットカードがご利用いただけます</p>
                    <p className="text-gray-700">• 料金は当日ご案内いたします</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Card */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <div className="bg-black text-white p-6 rounded-lg">
                  <div className="text-xs tracking-[0.3em] text-white/70 mb-4 font-mono">BOOKING / 03</div>
                  <h3 className="text-2xl font-bold mb-6">予約確定</h3>

                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between items-center py-3 border-b border-white/20">
                      <span className="text-white/80">体験</span>
                      <span className="font-medium">闇の館VR</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-white/20">
                      <span className="text-white/80">日時</span>
                      <span className="font-medium">
                        {new Date(bookingData.date).toLocaleDateString("ja-JP", {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        {bookingData.time}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-white/20">
                      <span className="text-white/80">参加者</span>
                      <span className="font-medium">{bookingData.participants}名</span>
                    </div>
                    <div className="flex justify-between items-center py-3">
                      <span className="text-white/80">支払い</span>
                      <span className="font-medium">現地決済</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Link
                      href={`/book/${params.experienceId}/details?date=${bookingData.date}&time=${bookingData.time}`}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full bg-transparent text-white border-white hover:bg-white hover:text-black"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        戻る
                      </Button>
                    </Link>

                    <Button
                      size="lg"
                      className="w-full bg-white text-black hover:bg-gray-100 font-medium"
                      onClick={handleConfirm}
                    >
                      予約を確定する
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>

                  <p className="text-xs text-white/60 mt-4 text-center">確定後、確認メールをお送りします</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
