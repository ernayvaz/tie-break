# Vercel’e Environment Variables (DATABASE_URL vb.) Ekleme

## Nereden eklenir?

1. **https://vercel.com** → giriş yapın.
2. **tie-break** projenize tıklayın.
3. Üst menüden **Settings**.
4. Sol menüden **Environment Variables**.

---

## Tek tek ekleme

### 1. DATABASE_URL

- **Key (Name):** `DATABASE_URL`
- **Value:** Kendi veritabanı connection string’iniz (Neon, Supabase vb.).  
  Örnek format: `postgresql://KULLANICI:SIFRE@HOST/VERITABANI?sslmode=require`
- **Environment:** Üçünü de işaretleyin: **Production**, **Preview**, **Development**.
- **Save** tıklayın.

### 2. Diğer gerekli değişkenler

Projenizde kullanıyorsanız aynı şekilde ekleyin:

| Key | Açıklama | Örnek / Not |
|-----|----------|-------------|
| `DIRECT_DATABASE_URL` | Migration için direct URL (Neon’da “Direct” connection string) | Neon’dan kopyalayın |
| `SESSION_SECRET` | Oturum şifreleme; en az 32 karakter rastgele string | Üretin veya mevcut .env’deki değeri kullanın |
| `NEXT_PUBLIC_APP_URL` | Canlı site adresi | `https://tie-break.uk` veya `https://xxx.vercel.app` |
| `FOOTBALL_DATA_ORG_API_KEY` | football-data.org API anahtarı | .env’deki değeri kopyalayın |

Her biri için:
- **Key** = tablodaki isim (tam aynı yazın).
- **Value** = kendi değeriniz (.env’den kopyalayabilirsiniz; canlı için `NEXT_PUBLIC_APP_URL`’i canlı adresinizle değiştirin).
- **Environment** = Production, Preview, Development (hepsini seçebilirsiniz).
- **Save**.

---

## Dikkat

- **Gizli bilgileri** (DATABASE_URL, SESSION_SECRET, API key) GitHub’a commit **etmeyin**. Sadece Vercel’de Environment Variables olarak girin.
- `.env` dosyası `.gitignore`’da olmalı (projede zaten olması gerekir).
- Değişken ekledikten veya değiştirdikten sonra **yeniden deploy** gerekir: **Deployments** → son deployment’ın sağındaki **⋯** → **Redeploy**.

---

## Özet adımlar

1. Vercel → Proje → **Settings** → **Environment Variables**.
2. **Add New** (veya **Add**) → Key: `DATABASE_URL`, Value: connection string’iniz → Environment’ları seçin → **Save**.
3. Aynı şekilde `SESSION_SECRET`, `NEXT_PUBLIC_APP_URL`, `FOOTBALL_DATA_ORG_API_KEY` (ve gerekirse `DIRECT_DATABASE_URL`) ekleyin.
4. **Deployments** → **Redeploy** ile son deploy’u tekrar çalıştırın.

Bu adımlardan sonra build ve çalışma sırasında `DATABASE_URL` ve diğer değişkenler kullanılır.
