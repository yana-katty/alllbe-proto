export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="space-y-8 text-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
          <div
            className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-primary/60 rounded-full animate-spin mx-auto"
            style={{ animationDirection: "reverse", animationDuration: "0.8s" }}
          />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">discovering transformations...</h2>
          <p className="text-white/60">preparing your journey into the impossible</p>
        </div>
      </div>
    </div>
  )
}
