"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowRight, ArrowLeft, User, Users } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useSearchParams } from "next/navigation"

export default function DetailsPage({ params }: { params: { experienceId: string } }) {
  const searchParams = useSearchParams()
  const selectedDate = searchParams.get("date")
  const selectedTime = searchParams.get("time")

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    participants: 1,
    specialRequests: "",
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === "participants" ? Number.parseInt(value) || 1 : value,
    }))
  }

  const handleContinue = () => {
    if (formData.name && formData.email && formData.phone) {
      const searchParams = new URLSearchParams({
        date: selectedDate || "",
        time: selectedTime || "",
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        participants: formData.participants.toString(),
        specialRequests: formData.specialRequests,
      })
      window.location.href = `/book/${params.experienceId}/confirm?${searchParams.toString()}`
    }
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
              <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-sm font-bold">
                2
              </div>
              <span className="text-sm font-medium">参加者情報</span>
            </div>
            <div className="flex-1 h-px bg-gray-300"></div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center text-sm">
                3
              </div>
              <span className="text-sm text-gray-600">確認</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="mb-12">
            <div className="text-xs tracking-[0.3em] text-gray-400 mb-4 font-mono">STEP 02</div>
            <h1 className="text-4xl font-bold text-black mb-4">参加者情報を入力してください</h1>
            <p className="text-gray-600">体験に必要な情報をご入力ください。</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Form */}
            <div className="lg:col-span-2">
              <div className="space-y-8">
                {/* Personal Information */}
                <div>
                  <div className="flex items-center space-x-3 mb-6">
                    <User className="w-5 h-5 text-black" />
                    <h2 className="text-xl font-bold text-black">代表者情報</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="name" className="text-sm font-medium text-gray-700 mb-2 block">
                        お名前 *
                      </Label>
                      <Input
                        id="name"
                        name="name"
                        type="text"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="山田太郎"
                        className="w-full"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="email" className="text-sm font-medium text-gray-700 mb-2 block">
                        メールアドレス *
                      </Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="example@email.com"
                        className="w-full"
                        required
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label htmlFor="phone" className="text-sm font-medium text-gray-700 mb-2 block">
                        電話番号 *
                      </Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="090-1234-5678"
                        className="w-full"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Participants */}
                <div>
                  <div className="flex items-center space-x-3 mb-6">
                    <Users className="w-5 h-5 text-black" />
                    <h2 className="text-xl font-bold text-black">参加人数</h2>
                  </div>

                  <div className="max-w-xs">
                    <Label htmlFor="participants" className="text-sm font-medium text-gray-700 mb-2 block">
                      参加者数 *
                    </Label>
                    <select
                      id="participants"
                      name="participants"
                      value={formData.participants}
                      onChange={(e) => handleInputChange(e as any)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    >
                      <option value={1}>1名</option>
                      <option value={2}>2名</option>
                      <option value={3}>3名</option>
                      <option value={4}>4名</option>
                    </select>
                  </div>
                </div>

                {/* Special Requests */}
                <div>
                  <Label htmlFor="specialRequests" className="text-sm font-medium text-gray-700 mb-2 block">
                    特別なご要望（任意）
                  </Label>
                  <textarea
                    id="specialRequests"
                    name="specialRequests"
                    value={formData.specialRequests}
                    onChange={handleInputChange}
                    placeholder="アレルギーや配慮が必要な事項があればご記入ください"
                    rows={4}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent resize-none"
                  />
                </div>

                {/* Terms */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="font-bold text-black mb-3">利用規約・注意事項</h3>
                  <ul className="text-sm text-gray-600 space-y-2 mb-4">
                    <li>• 13歳未満の方は保護者同伴が必要です</li>
                    <li>• 心臓疾患をお持ちの方はご参加をお控えください</li>
                    <li>• 開始時刻の10分前までにお越しください</li>
                    <li>• キャンセルは前日まで可能です</li>
                    <li>• 現地での決済となります</li>
                  </ul>
                  <label className="flex items-start space-x-3">
                    <input type="checkbox" className="mt-1" required />
                    <span className="text-sm text-gray-700">上記の利用規約・注意事項に同意します</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Summary Card */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="font-bold text-black mb-4">予約内容</h3>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between">
                      <span className="text-gray-600">体験</span>
                      <span className="font-medium">闇の館VR</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">日付</span>
                      <span className="font-medium">
                        {selectedDate
                          ? new Date(selectedDate).toLocaleDateString("ja-JP", {
                              month: "short",
                              day: "numeric",
                              weekday: "short",
                            })
                          : "未選択"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">時間</span>
                      <span className="font-medium">{selectedTime || "未選択"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">参加者数</span>
                      <span className="font-medium">{formData.participants}名</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Link href={`/book/${params.experienceId}/datetime?date=${selectedDate}&time=${selectedTime}`}>
                      <Button variant="outline" size="sm" className="w-full bg-transparent">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        戻る
                      </Button>
                    </Link>

                    <Button
                      size="lg"
                      className="w-full bg-black text-white hover:bg-gray-800"
                      onClick={handleContinue}
                      disabled={!formData.name || !formData.email || !formData.phone}
                    >
                      確認画面へ
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
