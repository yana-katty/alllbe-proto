"use client"

import { Header } from "@/components/shared/header"
import { Footer } from "@/components/shared/footer"
import { Button } from "@/components/ui/button"
import { ArrowRight, ArrowLeft, Calendar, Clock } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { getExperienceById } from "@/lib/constants"
import { notFound } from "next/navigation"

// Mock data for available time slots
const getAvailableSlots = () => {
  const today = new Date()
  const slots = []

  for (let i = 0; i < 14; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)

    const timeSlots = [
      { time: "10:00", available: Math.random() > 0.3 },
      { time: "12:00", available: Math.random() > 0.3 },
      { time: "14:00", available: Math.random() > 0.3 },
      { time: "16:00", available: Math.random() > 0.3 },
      { time: "18:00", available: Math.random() > 0.3 },
      { time: "20:00", available: Math.random() > 0.3 },
    ]

    slots.push({
      date: date.toISOString().split("T")[0],
      displayDate: date.toLocaleDateString("ja-JP", {
        month: "short",
        day: "numeric",
        weekday: "short",
      }),
      timeSlots,
    })
  }

  return slots
}

export default function DateTimePage({ params }: { params: { experienceId: string } }) {
  const experience = getExperienceById(params.experienceId)
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [selectedTime, setSelectedTime] = useState<string>("")
  const availableSlots = getAvailableSlots()

  if (!experience) {
    notFound()
  }

  const handleContinue = () => {
    if (selectedDate && selectedTime) {
      // 選択した日時をクエリパラメータで次のページに渡す
      const searchParams = new URLSearchParams({
        date: selectedDate,
        time: selectedTime,
      })
      window.location.href = `/book/${params.experienceId}/details?${searchParams.toString()}`
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Progress Bar */}
      <div className="bg-gray-100 py-4">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-sm font-bold">
                1
              </div>
              <span className="text-sm font-medium">日時選択</span>
            </div>
            <div className="flex-1 h-px bg-gray-300"></div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center text-sm">
                2
              </div>
              <span className="text-sm text-gray-600">参加者情報</span>
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
            <div className="text-xs tracking-[0.3em] text-gray-400 mb-4 font-mono">STEP 01</div>
            <h1 className="text-4xl font-bold text-black mb-4">日時を選択してください</h1>
            <p className="text-gray-600">ご希望の日付と時間をお選びください。</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Date Selection */}
            <div className="lg:col-span-2">
              <div className="mb-8">
                <div className="flex items-center space-x-3 mb-6">
                  <Calendar className="w-5 h-5 text-black" />
                  <h2 className="text-xl font-bold text-black">日付を選択</h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {availableSlots.slice(0, 12).map((slot) => (
                    <button
                      key={slot.date}
                      onClick={() => setSelectedDate(slot.date)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        selectedDate === slot.date
                          ? "border-black bg-black text-white"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <div className="text-sm font-medium">{slot.displayDate}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Selection */}
              {selectedDate && (
                <div>
                  <div className="flex items-center space-x-3 mb-6">
                    <Clock className="w-5 h-5 text-black" />
                    <h2 className="text-xl font-bold text-black">時間を選択</h2>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {availableSlots
                      .find((slot) => slot.date === selectedDate)
                      ?.timeSlots.map((timeSlot) => (
                        <button
                          key={timeSlot.time}
                          onClick={() => timeSlot.available && setSelectedTime(timeSlot.time)}
                          disabled={!timeSlot.available}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            !timeSlot.available
                              ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                              : selectedTime === timeSlot.time
                                ? "border-black bg-black text-white"
                                : "border-gray-200 hover:border-gray-300 bg-white"
                          }`}
                        >
                          <div className="font-medium">{timeSlot.time}</div>
                          {!timeSlot.available && <div className="text-xs mt-1">満席</div>}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Summary Card */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="font-bold text-black mb-4">選択内容</h3>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between">
                      <span className="text-gray-600">体験</span>
                      <span className="font-medium">{experience.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">日付</span>
                      <span className="font-medium">
                        {selectedDate
                          ? new Date(selectedDate).toLocaleDateString("ja-JP", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              weekday: "long",
                            })
                          : "未選択"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">時間</span>
                      <span className="font-medium">{selectedTime || "未選択"}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Link href={`/book/${params.experienceId}`}>
                      <Button variant="outline" size="sm" className="w-full bg-transparent">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        戻る
                      </Button>
                    </Link>

                    <Button
                      size="lg"
                      className="w-full bg-black text-white hover:bg-gray-800"
                      onClick={handleContinue}
                      disabled={!selectedDate || !selectedTime}
                    >
                      次へ進む
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
