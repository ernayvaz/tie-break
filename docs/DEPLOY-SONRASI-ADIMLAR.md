# Deploy Sonrası Yapmanız Gerekenler (Adım Adım)

Build ve deployment başarıyla tamamlandı. Aşağıdaki adımları sırayla yapın.

---

## 1. Canlı siteyi açın

1. **https://vercel.com** → giriş yapın.
2. **tie-break** projesine tıklayın.
3. Üstte **Visit** butonuna tıklayın veya **Domains** altındaki adresi (örn. `https://tie-break-xxx.vercel.app`) açın.
4. Site açılıyorsa (giriş sayfası, Tie-Break logosu) devam edin. Açılmıyorsa veya hata alırsanız Vercel’deki deployment log’una bakın.

---

## 2. tie-break.uk domain’ini bağlayın (henüz yapmadıysanız)

### 2.1 Vercel’de domain ekleyin

1. Vercel → **tie-break** → **Settings** → **Domains**.
2. **Add** → `tie-break.uk` yazın → **Add**.
3. Vercel’in gösterdiği **A** ve **CNAME** kayıtlarını not alın (örn. A: `76.76.21.21`, CNAME: `cname.vercel-dns.com`).

### 2.2 Cloudflare’de DNS ayarlayın

1. **https://dash.cloudflare.com** → **Websites** → **tie-break.uk** → **DNS** → **Records**.
2. **A** kaydı: Type `A`, Name `@`, IPv4 = Vercel’in verdiği IP, Proxy **kapalı** (gri bulut) → **Save**.
3. **CNAME** kaydı: Type `CNAME`, Name `www`, Target `cname.vercel-dns.com`, Proxy **kapalı** → **Save**.
4. 5–15 dakika bekleyin; Vercel’de domain **Valid** olunca **https://tie-break.uk** ve **https://www.tie-break.uk** sitenize gider.

---

## 3. Environment Variables kontrolü

1. Vercel → **tie-break** → **Settings** → **Environment Variables**.
2. **NEXT_PUBLIC_APP_URL** değerini kontrol edin:
   - Canlı adres için: `https://tie-break.uk` (veya kullandığınız domain).
   - Eğer hâlâ `http://localhost:3000` ise düzenleyin → **Save**.
3. Değişiklik yaptıysanız: **Deployments** → en üstteki deployment → **⋯** → **Redeploy** ile yeniden deploy alın.

---

## 4. Veritabanı (Neon) kontrolü

- Vercel’de **DATABASE_URL** ve (gerekirse) **DIRECT_DATABASE_URL** zaten ekli olmalı (Neon connection string).
- Canlı sitede giriş yapıp bir sayfa gezinin; veri geliyorsa veritabanı bağlantısı çalışıyordur.
- Hata alırsanız Neon dashboard’da projenin aktif ve connection string’in doğru olduğundan emin olun.

---

## 5. Kısa test listesi

1. **Giriş:** https://tie-break.uk (veya vercel.app adresiniz) → giriş sayfası açılıyor mu?
2. **Kayıt / Giriş:** Mevcut kullanıcı ile giriş yapıp Schedule sayfasına gidebiliyor musunuz?
3. **Schedule:** Maç listesi ve tahmin alanları görünüyor mu?
4. **Leaderboard:** Sıralama sayfası açılıyor mu?
5. **Admin (varsa):** Admin kullanıcı ile /admin ve alt sayfalar açılıyor mu?

Bir adımda takılırsanız tarayıcı konsolundaki (F12) hata mesajını ve hangi adımda olduğunuzu not alın.

---

## 6. Özet kontrol listesi

| # | Yapılacak | Durum |
|---|-----------|--------|
| 1 | Canlı siteyi Visit / domain ile açıp kontrol et | ☐ |
| 2 | tie-break.uk’yi Vercel’e ekle + Cloudflare DNS’i gir | ☐ |
| 3 | NEXT_PUBLIC_APP_URL = https://tie-break.uk (veya domain’iniz) yap, gerekirse Redeploy | ☐ |
| 4 | Giriş / Schedule / Leaderboard / Admin kısa test | ☐ |

Bu adımları tamamladıktan sonra site canlı ve kendi domain’inizle kullanıma hazır olur.
