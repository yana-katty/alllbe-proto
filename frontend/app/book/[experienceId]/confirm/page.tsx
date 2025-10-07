'use client'; 'use client'; "use client"



import { useParams, useRouter, useSearchParams } from 'next/navigation';

import { useState } from 'react';

import { trpc } from '@/lib/trpc'; import { useParams, useRouter, useSearchParams } from 'next/navigation'; import { Header } from "@/components/shared/header"

import { Button } from '@/components/ui/button';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; import { useState } from 'react'; import { Footer } from "@/components/shared/footer"

import { Separator } from '@/components/ui/separator';

import { Badge } from '@/components/ui/badge'; import { trpc } from '@/lib/trpc'; import { Button } from "@/components/ui/button"

import { Alert, AlertDescription } from '@/components/ui/alert';

import {import { Button } from '@/components/ui/button'; import { ArrowRight, ArrowLeft, CheckCircle, Calendar, Clock, User, Mail, Phone, Users } from "lucide-react"

ArrowLeft,

  Calendar,import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; import Link from "next/link"

Clock,

  Users,import { Separator } from '@/components/ui/separator'; import { useSearchParams } from "next/navigation"

MapPin,

  CreditCard,import { Badge } from '@/components/ui/badge'; import { getExperienceById } from "@/lib/constants"

AlertCircle,

  Loader2,import { Alert, AlertDescription } from '@/components/ui/alert'; import { notFound } from "next/navigation"

} from 'lucide-react';

import { format, parseISO } from 'date-fns'; import {

import { ja } from 'date-fns/locale';

ArrowLeft,export default function ConfirmPage({ params }: { params: { experienceId: string } }) {

  export default function ConfirmPage() {

    const params = useParams(); Calendar,  const experience = getExperienceById(params.experienceId)

    const router = useRouter();

    const searchParams = useSearchParams(); Clock,  



  const experienceId = params.experienceId as string; Users,  if (!experience) {

      const participants = parseInt(searchParams.get('participants') || '1', 10);

      const dateStr = searchParams.get('date') || ''; MapPin, notFound()

      const timeSlot = searchParams.get('timeSlot') || '';

      CreditCard,  }

    const [isBooking, setIsBooking] = useState(false);

    const [bookingError, setBookingError] = useState<string | null>(null); AlertCircle,  const searchParams = useSearchParams()



    const { data: experience, isLoading } = trpc.experience.getById.useQuery(experienceId); Loader2,  const bookingData = {



      const createBookingMutation = trpc.booking.create.useMutation({} from 'lucide-react'; date: searchParams.get("date") || "",

      onSuccess: (booking) => {

        router.push(`/book/${experienceId}/success?bookingId=${booking.id}`); import { format, parseISO } from 'date-fns'; time: searchParams.get("time") || "",

    },

      onError: (error) => {
        import { ja } from 'date-fns/locale'; name: searchParams.get("name") || "",

          setBookingError(error.message || '予約の作成に失敗しました');

        setIsBooking(false); email: searchParams.get("email") || "",

    },

    }); export default function ConfirmPage() {
      phone: searchParams.get("phone") || "",



  const handleConfirmBooking = async () => {
        const params = useParams(); participants: Number.parseInt(searchParams.get("participants") || "1"),

    if (!experience) return;

        const router = useRouter(); specialRequests: searchParams.get("specialRequests") || "",

          setIsBooking(true);

        setBookingError(null); const searchParams = useSearchParams();
      }



      try {

        const userId = 'temp-user-123';

        const selectedDate = parseISO(dateStr); const experienceId = params.experienceId as string; const handleConfirm = () => {

          const [hours, minutes] = timeSlot.includes(':')

            ? timeSlot.split(':').map(Number)  const participants = parseInt(searchParams.get('participants') || '1', 10);    // 実際の実装では、ここでAPIに予約データを送信

        : [10, 0];

        selectedDate.setHours(hours, minutes, 0, 0); const dateStr = searchParams.get('date') || ''; window.location.href = `/book/${params.experienceId}/complete`



        await createBookingMutation.mutateAsync({ const timeSlot = searchParams.get('timeSlot') || ''; }

        experienceId,

          userId,

          numberOfParticipants: participants.toString(),

          scheduledVisitTime: selectedDate,  const [isBooking, setIsBooking] = useState(false); return (

            status: 'confirmed',

      }); const [bookingError, setBookingError] = useState<string | null>(null);    <div className="min-h-screen bg-white">

    } catch (error) {

      console.error('Booking creation failed:', error);      <Header />

    }

  };  // Experience データ取得



  if (isLoading) {  const { data: experience, isLoading } = trpc.experience.getById.useQuery(experienceId);      {/* Progress Bar */}

    return (

      <div className="min-h-screen flex items-center justify-center">      <div className="bg-gray-100 py-4">

        <div className="text-center">

          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>  // Booking作成mutation        <div className="max-w-4xl mx-auto px-6">

          <p className="text-muted-foreground">読み込み中...</p>

        </div>  const createBookingMutation = trpc.booking.create.useMutation({          <div className="flex items-center space-x-4">

      </div>

    );    onSuccess: (booking) => {            <div className="flex items-center space-x-2">

  }

      // 予約成功ページへ遷移              <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">

                if (!experience || !dateStr || !timeSlot) {

    return (      router.push(`/book/${experienceId}/success?bookingId=${booking.id}`);                ✓

                <div className="min-h-screen flex items-center justify-center">

                  <Card className="max-w-md">    },              </div>

                <CardHeader>

                  <CardTitle>エラー</CardTitle>    onError: (error) => {              <span className="text-sm font-medium">日時選択</span>

            <CardDescription>予約情報が不完全です</CardDescription>

          </CardHeader>      setBookingError(error.message || '予約の作成に失敗しました');            </div>

              <CardContent>

                <Button onClick={() => router.push('/discover')} className="w-full">      setIsBooking(false);            <div className="flex-1 h-px bg-gray-300"></div>

                  体験を探す

                </Button>    },            <div className="flex items-center space-x-2">

              </CardContent>

            </Card>});              <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">

            </div>

            );                ✓

  }

  const handleConfirmBooking = async () => {              </div>

          const selectedDate = parseISO(dateStr);

          const formattedDate = format(selectedDate, 'yyyy年M月d日（E）', {locale: ja });    if (!experience) return;              <span className="text-sm font-medium">参加者情報</span>

          const formattedTime = timeSlot.includes(':') ? timeSlot : `${timeSlot.split('-')[0]}:00`;

        </div>

          return (

          <div className="min-h-screen bg-gray-50 py-8">    setIsBooking(true);            <div className="flex-1 h-px bg-gray-300"></div>

            <div className="container max-w-3xl mx-auto px-4">

              <div className="mb-6">    setBookingError(null);            <div className="flex items-center space-x-2">

                <Button variant="ghost" onClick={() => router.back()} className="mb-4" disabled={isBooking}>

                  <ArrowLeft className="mr-2 h-4 w-4" />              <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-sm font-bold">

                    戻る

                </Button>    try {3

                  < h1 className="text-3xl font-bold mb-2">予約内容の確認</h1>

                <p className="text-muted-foreground">内容をご確認の上、予約を確定してください</p>      // 仮のユーザーID（実際はAuth0から取得）              </div>

            </div>

            const userId = 'temp-user-123';              <span className="text-sm font-medium">確認</span>

            {bookingError && (

          <Alert variant="destructive" className="mb-6">            </div>

            <AlertCircle className="h-4 w-4" />

            <AlertDescription>{bookingError}</AlertDescription>      // 日時をISO文字列に変換          </div>

          </Alert>

        )}      const selectedDate = parseISO(dateStr);        </div>



        <div className="space-y-6">      const [hours, minutes] = timeSlot.includes(':')      </div>

        <Card>

          <CardHeader>        ? timeSlot.split(':').map(Number)

            <CardTitle>体験情報</CardTitle>

          </CardHeader>        : [10, 0];      {/* Main Content */}

          <CardContent className="space-y-4">

            <div>      selectedDate.setHours(hours, minutes, 0, 0);      <section className="py-16">

              <h3 className="text-xl font-semibold mb-2">{experience.title}</h3>

              {experience.description && (<div className="max-w-4xl mx-auto px-6">

                <p className="text-muted-foreground line-clamp-3">{experience.description}</p>

                )}      await createBookingMutation.mutateAsync({<div className="mb-12">

                </div>

        experienceId,            <div className="text-xs tracking-[0.3em] text-gray-400 mb-4 font-mono">STEP 03</div>

                {experience.location && (

                  <div className="flex items-start gap-3">        userId,            <h1 className="text-4xl font-bold text-black mb-4">予約内容をご確認ください</h1>

                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />

                    <div>        numberOfParticipants: participants.toString(),            <p className="text-gray-600">内容に間違いがなければ、予約を確定してください。</p>

                      <p className="font-medium">開催場所</p>

                      <p className="text-sm text-muted-foreground">{experience.location}</p>        scheduledVisitTime: selectedDate,          </div>

                  </div>

                </div>        status: 'confirmed',

              )}

      });          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

                {experience.duration && (

                  <div className="flex items-start gap-3">    } catch (error) {{/* Confirmation Details */ }

                    < Clock className="h-5 w-5 text-muted-foreground mt-0.5" />

                    <div>      // エラーハンドリングはonErrorで処理済み            <div className="lg:col-span-2">

                      <p className="font-medium">所要時間</p>

                      <p className="text-sm text-muted-foreground">{experience.duration}</p>      console.error('Booking creation failed:', error);              <div className="space-y-8">

                      </div>

                    </div>    }                {/* Experience Details */}

              )}

                    </CardContent>  };                <div className="bg-gray-50 p-6 rounded-lg">

                    </Card>

                    <h2 className="text-xl font-bold text-black mb-4">体験内容</h2>

                    <Card>

                      <CardHeader>  if (isLoading) {<div className="space-y-3">

                        <CardTitle>予約詳細</CardTitle>

                      </CardHeader>    return (                    <div className="flex items-center space-x-3">

                          <CardContent className="space-y-4">

                            <div className="flex items-start gap-3">      <div className="min-h-screen flex items-center justify-center">                      <CheckCircle className="w-5 h-5 text-green-600" />

                              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />

                              <div>        <div className="text-center">                      <span className="font-medium">闇の館VR</span>

                                <p className="font-medium">日付</p>

                                <p className="text-sm text-muted-foreground">{formattedDate}</p>          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>                    </div>

                              </div>

                            </div>          <p className="text-muted-foreground">読み込み中...</p>                    <div className="flex items-center space-x-3">



                                <div className="flex items-start gap-3">        </div>                      <Calendar className="w-5 h-5 text-gray-600" />

                                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />

                                <div>      </div>                      <span>

                                  <p className="font-medium">時間</p>

                                  <p className="text-sm text-muted-foreground">{formattedTime}</p>    );                        {new Date(bookingData.date).toLocaleDateString("ja-JP", {

                </div>

                            </div>  }                          year: "numeric",



                            <div className="flex items-start gap-3">                          month: "long",

                              <Users className="h-5 w-5 text-muted-foreground mt-0.5" />

                              <div>  if (!experience || !dateStr || !timeSlot) {day: "numeric",

                                <p className="font-medium">参加人数</p>

                                <p className="text-sm text-muted-foreground">{participants}名</p>    return (                          weekday: "long",

                              </div>

                            </div>      <div className="min-h-screen flex items-center justify-center">                        })}

                          </CardContent>

                        </Card>        <Card className="max-w-md">                      </span>



                        {experience.price && (          <CardHeader>                    </div>

            <Card>

              <CardHeader>            <CardTitle>エラー</CardTitle>                    <div className="flex items-center space-x-3">

                <CardTitle>料金情報</CardTitle>

              </CardHeader>            <CardDescription>予約情報が不完全です</CardDescription>                      <Clock className="w-5 h-5 text-gray-600" />

              <CardContent className="space-y-4">

                <div className="flex justify-between items-center">          </CardHeader>                      <span>{bookingData.time} 開始（45分間）</span>

                  <span className="text-muted-foreground">

                    {experience.title} × {participants}名          <CardContent>                    </div>

                  </span>

                  <span className="font-medium">{experience.price}</span>            <Button onClick={() => router.push('/discover')} className="w-full">                    <div className="flex items-center space-x-3">

                </div>

              体験を探す                      <Users className="w-5 h-5 text-gray-600" />

                <Separator />

            </Button>                      <span>{bookingData.participants}名</span>

                <div className="flex justify-between items-center text-lg font-semibold">

                  <span>合計金額</span>          </CardContent>                    </div>

                  <span className="text-primary">{experience.price}</span>

                </div>        </Card>                  </div>



                {experience.paymentMethods && (      </div>                </div>

            <div className="flex items-start gap-3 pt-4">

              <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />    );

              <div>

                <p className="font-medium mb-2">利用可能な支払い方法</p>  }                {/* Contact Information */}

                <div className="flex flex-wrap gap-2">

                  {JSON.parse(experience.paymentMethods).map((method: string) => (<div className="bg-gray-50 p-6 rounded-lg">

                    <Badge key={method} variant="secondary">

                      {method === 'onsite' ? '現地払い' : method === 'online' ? 'オンライン決済' : method}  // 日時のフォーマット                  <h2 className="text-xl font-bold text-black mb-4">代表者情報</h2>

                    </Badge>

                        ))}  const selectedDate = parseISO(dateStr);                  <div className="space-y-3">

                    </div>

                  </div>  const formattedDate = format(selectedDate, 'yyyy年M月d日（E）', {locale: ja });                    <div className="flex items-center space-x-3">

                  </div>

                )}  const formattedTime = timeSlot.includes(':')                      <User className="w-5 h-5 text-gray-600" />

                </CardContent>

              </Card>    ? timeSlot                      <span>{bookingData.name}</span>

          )}

              : `${timeSlot.split('-')[0]}:00`;                    </div>

            {experience.notes && (

              <Card>                    <div className="flex items-center space-x-3">

                <CardHeader>

                  <CardTitle>注意事項</CardTitle>  return (                      <Mail className="w-5 h-5 text-gray-600" />

                </CardHeader>

                <CardContent>    <div className="min-h-screen bg-gray-50 py-8">                      <span>{bookingData.email}</span>

                  <ul className="space-y-2">

                    {JSON.parse(experience.notes).map((note: string, index: number) => (      <div className="container max-w-3xl mx-auto px-4">                    </div>

                    <li key={index} className="flex gap-2 text-sm">

                      <span className="text-muted-foreground">•</span>        {/* ヘッダー */}                    <div className="flex items-center space-x-3">

                      <span>{note}</span>

                    </li>        <div className="mb-6">                      <Phone className="w-5 h-5 text-gray-600" />

                  ))}

                </ul>          <Button                      <span>{bookingData.phone}</span>

                </CardContent>

              </Card>            variant="ghost"                    </div>

          )}

          onClick={() => router.back()}                  </div>

        <div className="flex gap-4">

          <Button variant="outline" onClick={() => router.back()} disabled={isBooking} className="flex-1">            className="mb-4"                </div>

      修正する

            </Button > disabled={ isBooking }

      <Button onClick={handleConfirmBooking} disabled={isBooking} className="flex-1" size="lg">

        {isBooking ? (          > {/* Special Requests */ }

          <>

                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />            <ArrowLeft className="mr-2 h-4 w-4" />                {bookingData.specialRequests && (

          予約処理中...

      </>            戻る < div className = "bg-gray-50 p-6 rounded-lg" >

              ) : (

        '予約を確定する'          </Button > <h2 className="text-xl font-bold text-black mb-4">特別なご要望</h2>

              )
    }

            </Button >          <h1 className="text-3xl font-bold mb-2">予約内容の確認</h1>                    <p className="text-gray-700">{bookingData.specialRequests}</p>

          </div >

        </div > <p className="text-muted-foreground">                  </div>

      </div >

    </div > 内容をご確認の上、予約を確定してください                )
  }

  );

}          </p >


        </div > {/* Payment Information */ }

  < div className = "bg-yellow-50 border border-yellow-200 p-6 rounded-lg" >

    {/* エラーメッセージ */ } < h2 className = "text-xl font-bold text-black mb-4" > お支払いについて</h2 >

      { bookingError && (<div className="space-y-2">

        <Alert variant="destructive" className="mb-6">                    <p className="text-gray-700">• お支払いは当日現地にて承ります</p>

          <AlertCircle className="h-4 w-4" />                    <p className="text-gray-700">• 現金またはクレジットカードがご利用いただけます</p>

          <AlertDescription>{bookingError}</AlertDescription>                    <p className="text-gray-700">• 料金は当日ご案内いたします</p>

        </Alert>                  </div>

      )}                </div >

              </div >

  <div className="space-y-6">            </div>

{/* 体験情報カード */ }

<Card>            {/* Action Card */}

  <CardHeader>            <div className="lg:col-span-1">

    <CardTitle>体験情報</CardTitle>              <div className="sticky top-24">

    </CardHeader>                <div className="bg-black text-white p-6 rounded-lg">

      <CardContent className="space-y-4">                  <div className="text-xs tracking-[0.3em] text-white/70 mb-4 font-mono">BOOKING / 03</div>

        <div>                  <h3 className="text-2xl font-bold mb-6">予約確定</h3>

          <h3 className="text-xl font-semibold mb-2">{experience.title}</h3>

          {experience.description && (<div className="space-y-4 mb-8">

            <p className="text-muted-foreground line-clamp-3">                    <div className="flex justify-between items-center py-3 border-b border-white/20">

              {experience.description}                      <span className="text-white/80">体験</span>

            </p>                      <span className="font-medium">闇の館VR</span>

                )}                    </div>

              </div>                    <div className="flex justify-between items-center py-3 border-b border-white/20">

          <span className="text-white/80">日時</span>

          {experience.location && (<span className="font-medium">

            <div className="flex items-start gap-3">                        {new Date(bookingData.date).toLocaleDateString("ja-JP", {

                  < MapPin className = "h-5 w-5 text-muted-foreground mt-0.5" /> month: "short",

              <div>                          day: "numeric",

                <p className="font-medium">開催場所</p>                        })}{" "}

                <p className="text-sm text-muted-foreground">{experience.location}</p>                        {bookingData.time}

              </div>                      </span>

                </div>                    </div>

              )}                    <div className="flex justify-between items-center py-3 border-b border-white/20">

      <span className="text-white/80">参加者</span>

      {experience.duration && (                      <span className="font-medium">{bookingData.participants}名</span>

                <div className="flex items-start gap-3">                    </div>

                  <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />                    <div className="flex justify-between items-center py-3">

                  <div>                      <span className="text-white/80">支払い</span>

                    <p className="font-medium">所要時間</p>                      <span className="font-medium">現地決済</span>

                    <p className="text-sm text-muted-foreground">{experience.duration}</p>                    </div>

                  </div>                  </div>

  </div>

              )}                  <div className="space-y-3">

    </CardContent>                    <Link

          </Card>                      href = {`/book/${params.experienceId}/details?date=${bookingData.date}&time=${bookingData.time}`}

                    >

  {/* 予約詳細カード */ } < Button

  < Card > variant="outline"

    < CardHeader > size="sm"

      < CardTitle > 予約詳細</CardTitle > className="w-full bg-transparent text-white border-white hover:bg-white hover:text-black"

            </CardHeader >                      >

  <CardContent className="space-y-4">                        <ArrowLeft className="w-4 h-4 mr-2" />

    <div className="flex items-start gap-3">                        戻る

      <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />                      </Button>

    <div>                    </Link>

    <p className="font-medium">日付</p>

    <p className="text-sm text-muted-foreground">{formattedDate}</p>                    <Button

                </div>                      size = "lg"

              </div > className="w-full bg-white text-black hover:bg-gray-100 font-medium"

onClick = { handleConfirm }

  < div className = "flex items-start gap-3" >                    >

    <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />                      予約を確定する

      < div >                      <ArrowRight className="w-4 h-4 ml-2" />

                  <p className="font-medium">時間</p>                    </Button >

  <p className="text-sm text-muted-foreground">{formattedTime}</p>                  </div >

                </div >

              </div > <p className="text-xs text-white/60 mt-4 text-center">確定後、確認メールをお送りします</p>

                </div >

              <div className="flex items-start gap-3">              </div>

                <Users className="h-5 w-5 text-muted-foreground mt-0.5" />            </div >

                <div>          </div>

                  <p className="font-medium">参加人数</p>        </div >

  <p className="text-sm text-muted-foreground">{participants}名</p>      </section >

                </div >

              </div > <Footer />

            </CardContent >    </div >

          </Card >  )

}

{/* 料金情報カード */ }
{
  experience.price && (
    <Card>
      <CardHeader>
        <CardTitle>料金情報</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">
            {experience.title} × {participants}名
          </span>
          <span className="font-medium">{experience.price}</span>
        </div>

        <Separator />

        <div className="flex justify-between items-center text-lg font-semibold">
          <span>合計金額</span>
          <span className="text-primary">{experience.price}</span>
        </div>

        {experience.paymentMethods && (
          <div className="flex items-start gap-3 pt-4">
            <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium mb-2">利用可能な支払い方法</p>
              <div className="flex flex-wrap gap-2">
                {JSON.parse(experience.paymentMethods).map(
                  (method: string) => (
                    <Badge key={method} variant="secondary">
                      {method === 'onsite'
                        ? '現地払い'
                        : method === 'online'
                          ? 'オンライン決済'
                          : method}
                    </Badge>
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

{/* 注意事項 */ }
{
  experience.notes && (
    <Card>
      <CardHeader>
        <CardTitle>注意事項</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {JSON.parse(experience.notes).map((note: string, index: number) => (
            <li key={index} className="flex gap-2 text-sm">
              <span className="text-muted-foreground">•</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

{/* 確認ボタン */ }
<div className="flex gap-4">
  <Button
    variant="outline"
    onClick={() => router.back()}
    disabled={isBooking}
    className="flex-1"
  >
    修正する
  </Button>
  <Button
    onClick={handleConfirmBooking}
    disabled={isBooking}
    className="flex-1"
    size="lg"
  >
    {isBooking ? (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        予約処理中...
      </>
    ) : (
      '予約を確定する'
    )}
  </Button>
</div>
        </div >
      </div >
    </div >
  );
}
