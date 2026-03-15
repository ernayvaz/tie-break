# Tie Break – UEFA Şampiyonlar Ligi Tahmin Platformu

Özel, eğlence amaçlı tahmin platformu (~200 kullanıcı). Next.js, TypeScript, Tailwind, PostgreSQL, Prisma.

---

## Adım adım ne yapmalıyım?

Aşağıdaki adımları sırayla uygulayın.

### Adım 1: Proje klasörüne gir

Terminalde (PowerShell veya CMD):

```bash
cd c:\Users\e.ayvaz\Desktop\Tie-Break
```

### Adım 2: Bağımlılıkları yükle

```bash
npm install --legacy-peer-deps
```

İşlem bitene kadar bekleyin.

### Adım 3: Ücretsiz veritabanı oluştur (Neon)

1. Tarayıcıda **https://neon.tech** adresine gidin.
2. **Sign up** ile (Google veya e-posta ile) ücretsiz hesap açın.
3. Giriş yaptıktan sonra **Create a project** butonuna tıklayın.
4. **Project name** kısmına örneğin `tiebreak` yazın, **Create project** deyin.
5. Açılan sayfada **Connection string** bölümünü bulun. **URI** yazan yerdeki metni kopyalayın. Örnek:
   ```text
   postgresql://kullanici:sifre@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
   Bu metnin tamamını kopyalayıp bir yere (Not Defteri vb.) yapıştırın; bir sonraki adımda kullanacaksınız.

### Adım 4: `.env` dosyasını düzenle

1. Proje klasöründe **`.env`** dosyasını açın (yoksa **`.env.example`** dosyasını kopyalayıp **`.env`** adıyla kaydedin).
2. **`DATABASE_URL`** satırını bulun. Tırnak içindeki kısmı **Adım 3’te kopyaladığınız Neon connection string** ile değiştirin. Örnek:
   ```env
   DATABASE_URL="postgresql://kullanici:sifre@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require"
   ```
3. **`SESSION_SECRET`** satırını bulun. En az 32 karakter uzunluğunda rastgele bir metin yazın. Örnek:
   ```env
   SESSION_SECRET="tiebreak-gizli-anahtar-32-karakter-veya-uzun"
   ```
4. Dosyayı kaydedin.

### Adım 5: Veritabanı tablolarını oluştur

Terminalde (proje klasöründe):

```bash
npx prisma migrate dev --name init
```

Sorulursa “We need to reset the database” gibi bir şey çıkarsa **y** yazıp Enter’a basın. Bu komut tüm tabloları oluşturur; **hiç SQL yazmanız gerekmez**.

### Adım 6: Başlangıç verisini yükle (isteğe bağlı)

Admin kullanıcı ve ödül kayıtları için:

```bash
npm run db:seed
```

Bundan sonra girişte kullanacağınız hesap: **Kullanıcı adı:** `admin`, **PIN:** `1234`.

### Adım 7: Uygulamayı çalıştır

```bash
npm run dev
```

Tarayıcıda **http://localhost:3000** adresine gidin. Ana sayfada “Giriş / Kayıt” linkine tıklayarak giriş sayfasına gidebilirsiniz. Seed çalıştırdıysanız `admin` / `1234` ile giriş yapabilirsiniz (giriş formu Faz 3’te tamamlanacak).

---

## Tasarım

- İskandinav renk paleti (Nord), sade ve minimal arayüz.
- Futbol teması: yumuşak yeşil vurgular, okunaklı tipografi.

## Gereksinimler

- Node.js 18+
- npm veya pnpm  
- **Veritabanı:** Yerel PostgreSQL yok; online ücretsiz PostgreSQL kullanılıyor (Neon veya Supabase).

## Online ücretsiz veritabanı (SQL yok)

Proje yerel SQL/PostgreSQL kurulumu gerektirmez. Tablolar Prisma ile otomatik oluşturulur.

### Seçenek 1: Neon (önerilen)

1. [neon.tech](https://neon.tech) adresine gidin, ücretsiz hesap açın.
2. **Create a project** → proje adı (örn. `tiebreak`) → **Create project**.
3. Dashboard’da **Connection string** kopyalayın (URI formatında).
4. `.env` dosyasında `DATABASE_URL` olarak yapıştırın:
   ```env
   DATABASE_URL="postgresql://...?sslmode=require"
   ```

### Seçenek 2: Supabase

1. [supabase.com](https://supabase.com) → **Start your project** → ücretsiz hesap.
2. **New project** → Organization + proje adı + şifre.
3. **Settings** → **Database** → **Connection string** → **URI** kopyalayın.
4. `.env` içinde `DATABASE_URL` olarak kullanın (şifreyi kendi belirlediğinizle değiştirin).

Bu adımlardan sonra hiç SQL yazmadan `npx prisma migrate dev` çalıştırmanız yeterli; tüm tablolar oluşturulur.

## Kurulum

1. Bağımlılıkları yükle:

   ```bash
   npm install --legacy-peer-deps
   ```

2. `.env` oluştur ve **online veritabanı** bağlantı adresini ekle:

   ```bash
   cp .env.example .env
   # .env içinde DATABASE_URL (Neon/Supabase URL'si) ve SESSION_SECRET'ı düzenle
   ```

3. Veritabanı tablolarını oluştur (Prisma migration – SQL yazmaya gerek yok):

   ```bash
   npx prisma migrate dev --name init
   ```

4. (İsteğe bağlı) Seed verisi:

   ```bash
   npm run db:seed
   ```
   Varsayılan admin: `admin` / PIN: `1234` (ilk girişten sonra değiştir).

5. Geliştirme sunucusu:

   ```bash
   npm run dev
   ```

   Tarayıcıda: [http://localhost:3000](http://localhost:3000).

## Testler (Faz 19)

- **Otomatik testler (Vitest):** `npm run test` (watch) veya `npm run test:run` (tek seferde). Auth (PIN), doğrulama (login/register) ve tahmin değerleri (1/X/2) için unit testler.
- **Manuel kabul checklist:** `docs/TEST-CHECKLIST.md` — ortam, giriş/kayıt, schedule, leaderboard, tahminler, admin işlemleri için adım adım test maddeleri.

## Ortam Değişkenleri

| Değişken | Açıklama |
|----------|----------|
| `DATABASE_URL` | Online PostgreSQL bağlantı URL’si (Neon veya Supabase) |
| `SESSION_SECRET` | Oturum cookie’si için gizli anahtar (en az 32 karakter) |
| `NEXT_PUBLIC_APP_URL` | Uygulama kök URL’i (örn. http://localhost:3000) |
| `FOOTBALL_DATA_ORG_API_KEY` | football-data.org API anahtarı (opsiyonel, senkron için) |

## Proje Yapısı (Faz 0–2)

- `src/app/` – App Router sayfaları
- `src/lib/auth/` – PIN hash, oturum, getCurrentUser, requireAuth, requireAdmin
- `src/lib/db.ts` – Prisma tek instance
- `src/middleware.ts` – Koruma: /schedule, /admin vb. için cookie kontrolü
- `prisma/schema.prisma` – Veritabanı şeması

## Veritabanı

- **SQL kullanılmıyor.** Tüm şema Prisma ile yönetilir; tablolar `npx prisma migrate dev` ile oluşturulur.
- Online ücretsiz PostgreSQL (Neon veya Supabase) kullanın; yerel kurulum gerekmez.
- Tablolar: users, sessions, matches, predictions, leaderboard, prizes, invite_links, admin_logs, api_sync_logs.
