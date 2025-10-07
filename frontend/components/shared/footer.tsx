export function Footer() {
  return (
    <footer className="bg-black text-white py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div className="md:col-span-1">
            <div className="text-2xl font-bold mb-4">Alllbe</div>
            <p className="text-white/70 text-sm">
              展示に来る前も来た後も楽しい体験を提供します
            </p>
          </div>

          <div>
            <h3 className="font-bold mb-4">体験</h3>
            <ul className="space-y-2 text-sm text-white/70">
              <li>
                <a href="/discover" className="hover:text-white transition-colors">
                  体験を探す
                </a>
              </li>
              <li>
                <a href="/category/horror" className="hover:text-white transition-colors">
                  ホラー・ミステリー
                </a>
              </li>
              <li>
                <a href="/category/vr" className="hover:text-white transition-colors">
                  VR・デジタル
                </a>
              </li>
              <li>
                <a href="/category/theater" className="hover:text-white transition-colors">
                  没入型演劇
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold mb-4">サポート</h3>
            <ul className="space-y-2 text-sm text-white/70">
              <li>
                <a href="/help" className="hover:text-white transition-colors">
                  ヘルプセンター
                </a>
              </li>
              <li>
                <a href="/faq" className="hover:text-white transition-colors">
                  よくある質問
                </a>
              </li>
              <li>
                <a href="/contact" className="hover:text-white transition-colors">
                  お問い合わせ
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold mb-4">会社情報</h3>
            <ul className="space-y-2 text-sm text-white/70">
              <li>
                <a href="/about" className="hover:text-white transition-colors">
                  私たちについて
                </a>
              </li>
              <li>
                <a href="/terms" className="hover:text-white transition-colors">
                  利用規約
                </a>
              </li>
              <li>
                <a href="/privacy" className="hover:text-white transition-colors">
                  プライバシーポリシー
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/20 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-white/60">
            <p>© 2025 Alllbe. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="hover:text-white transition-colors">
                Twitter
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Instagram
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Facebook
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
