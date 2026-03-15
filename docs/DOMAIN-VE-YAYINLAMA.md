# Tie-Break: Ücretsiz / Ucuz Domain ve Yayınlama Rehberi

Bu rehber, projeyi internette yayınlayıp **ücretsiz** veya **ucuz bir domain** ile erişmenizi adım adım anlatır.

---

## Domain adı: Sadece Tie-Break (.com veya www ile)

- **İstediğiniz adres örnekleri:** `tie-break.com` veya `www.tie-break.com`. İkisi de aynı siteye gidebilir; rehberdeki DNS adımları hem ana domain’i hem www’yi Vercel’e bağlar.
- **İsimde ekstra kelime istemiyorsanız:** Domain adı tam olarak **tie-break** olabilir; yani **tie-break.com** almanız yeterli (ekstra “platform”, “app” vb. gerekmez).
- **“.com” hakkında:** İnternette her domain’in bir uzantısı olmak zorundadır (.com, .uk, .net, .org vb.). Uzantısız sadece “tie-break” diye bir adres mümkün değildir. Örnek: **tie-break.uk** = isim “tie-break”, uzantı “.uk”.

---

## Seçenek 1: En Basit – Sadece Ücretsiz URL (Domain almadan)

Next.js projesini **Vercel**’e deploy ederseniz, size **ücretsiz** bir adres verilir:

- Örnek: `tie-break-xxx.vercel.app`
- HTTPS otomatik açılır.
- Gerçek bir domain satın almanıza gerek yok.

### Adımlar

1. **GitHub hesabı**
   - https://github.com adresinden ücretsiz hesap açın (yoksa).

2. **Projeyi GitHub’a atın**
   - Proje klasöründe terminal açın:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```
   - GitHub’da yeni bir repo oluşturun (örn. `tie-break`).
   - Sonra:
   ```bash
   git remote add origin https://github.com/KULLANICI_ADINIZ/tie-break.git
   git branch -M main
   git push -u origin main
   ```

3. **Vercel’e girin**
   - https://vercel.com → “Sign Up” → “Continue with GitHub”.
   - GitHub ile giriş yapın.

4. **Projeyi Vercel’e ekleyin**
   - “Add New…” → “Project”.
   - “Import” ile `tie-break` (veya repo adınız) reposunu seçin.
   - “Environment Variables” kısmında `.env` içindeki değişkenleri ekleyin (örn. `DATABASE_URL`). Değerleri kopyalayıp Vercel’e yapıştırın.
   - “Deploy”e tıklayın.

5. **Bitiş**
   - Birkaç dakika sonra size `https://tie-break-xxxx.vercel.app` gibi bir link verilir. Bu artık sitenizin gerçek adresidir; localhost yerine bunu kullanırsınız.

Bu adres **ücretsiz** ve **kalıcıdır** (repo silinene / proje kaldırılana kadar). Ekstra domain almanız gerekmez.

---

## Seçenek 2: Kendi Domain’inizi Kullanmak – En Güvenilir Yol (Adım Adım)

### Hangi siteden domain almalı?

**Öneri: Cloudflare (Registrar)**  
- Dünya çapında altyapı ve DNS sağlayıcısı; ekstra kar koymadan **maliyet fiyatına** domain satar.
- Ücretsiz DNS, DDoS koruması, otomatik SSL ile uyumlu; kurulumu basit.
- Site: **https://www.cloudflare.com/products/registrar/**

Alternatif: Domain başka yerde (Namecheap, Porkbun vb.) alınmışsa, DNS’i Cloudflare’e taşıyabilir veya doğrudan o sağlayıcıda Vercel için DNS kayıtlarını ekleyebilirsiniz. Aşağıdaki adımlar **domain’i Cloudflare’den aldığınız** senaryoya göre yazıldı.

---

### Adım 1: Cloudflare hesabı ve domain arama

1. **https://dash.cloudflare.com** adresine gidin.
2. Hesabınız yoksa **Sign Up** ile e-posta ve şifre ile kayıt olun.
3. Sol menüden **Domain Registration** (veya **Web3** → **Domain Registration**) bölümüne girin.
4. Arama kutusuna istediğiniz adı yazın (örn. `tiebreak`).
5. Listeden uygun domain’i seçin (.com, .net, .app vb.). Fiyat ekranda görünür; **Purchase** / **Continue** ile sepete ekleyin.
6. Ödeme bilgilerini girip satın almayı tamamlayın. Domain hesabınıza eklenir.

---

### Adım 2: Sitenizi Vercel’de yayında olacak şekilde hazırlayın

Kendi domain’inizi kullanmak için sitenin **Vercel**’de yayında olması gerekir.

1. Projenizi **GitHub**’a atın (yoksa):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/KULLANICI_ADINIZ/tie-break.git
   git branch -M main
   git push -u origin main
   ```
2. **https://vercel.com** → GitHub ile giriş yapın → **Add New** → **Project** → Repo’nuzu seçin.
3. **Environment Variables** kısmında `DATABASE_URL` vb. gerekli değişkenleri ekleyin (canlı veritabanı kullanıyorsanız).
4. **Deploy**’e tıklayın. Deploy bitince `https://tie-break-xxxx.vercel.app` gibi bir adresiniz olacak.

---

### Adım 3: Domain’i Vercel projesine ekleyin

1. **Vercel** dashboard’da projenize tıklayın.
2. Üst menüden **Settings** → sol taraftan **Domains**’i seçin.
3. **Add** butonuna tıklayın.
4. Satın aldığınız domain’i yazın (örn. `tiebreak.com`) ve **Add** deyin.
5. Vercel size **DNS kayıtlarını** gösterecek. Örneğin:
   - **A record:** Name `@`, Value `76.76.21.21`
   - **CNAME record:** Name `www`, Value `cname.vercel-dns.com`  
   Bu değerleri bir yere not alın veya ekranı açık bırakın.

---

### Adım 4: Cloudflare’de DNS kayıtlarını girin

1. **https://dash.cloudflare.com** → Sol menüden **Websites** → satın aldığınız domain’e tıklayın.
2. Soldan **DNS** → **Records** bölümüne girin.
3. Vercel’in söylediği kayıtları tek tek ekleyin:

   **Ana domain (tiebreak.com) için:**
   - **Type:** `A`  
   - **Name:** `@`  
   - **IPv4 address:** Vercel’in verdiği IP (örn. `76.76.21.21`)  
   - **Proxy status:** DNS only (turuncu bulut kapalı; gri bulut)  
   - **Save**

   **www için:**
   - **Type:** `CNAME`  
   - **Name:** `www`  
   - **Target:** `cname.vercel-dns.com`  
   - **Proxy status:** DNS only (gri bulut)  
   - **Save**

4. Vercel farklı bir kayıt önerdiyse (ör. sadece CNAME), ekrandaki talimatı takip edin; yine **Name** ve **Target/Value** değerlerini Cloudflare’e aynen girin.

---

### Adım 5: Doğrulama ve SSL

1. Vercel’de **Domains** sayfasına dönün. Domain’in yanında bir süre **Pending** / **Configuring** yazabilir.
2. DNS yayılımı genelde **5–15 dakika** sürer; bazen 48 saate kadar çıkabilir.
3. Doğrulama tamamlanınca Vercel otomatik **SSL (HTTPS)** tanımlar; **Valid Configuration** veya yeşil tik görürsünüz.
4. Tarayıcıda `https://tiebreak.com` ve `https://www.tiebreak.com` adreslerini açarak sitenizin açıldığını kontrol edin.

---

### Özet kontrol listesi

| Adım | Ne yapacaksınız |
|------|------------------|
| 1 | Cloudflare’de hesap açıp domain satın alın (örn. tiebreak.com). |
| 2 | Projeyi GitHub’a atıp Vercel’e deploy edin; .vercel.app adresi çalışsın. |
| 3 | Vercel → Proje → Settings → Domains → domain’i ekleyin; çıkan DNS kayıtlarını not alın. |
| 4 | Cloudflare → Domain → DNS → Records → Vercel’in istediği A ve CNAME kayıtlarını ekleyin. |
| 5 | Bir süre bekleyin; Vercel’de domain “Valid” olunca https://sizin-domain.com ile siteye girin. |

Bu adımlarla kendi domain’iniz en güvenilir yollardan biri olan **Cloudflare** üzerinden satın alınmış ve **Vercel**’e bağlanmış olur.

---

## Sizin domain: tie-break.uk (Cloudflare’den alındıysa)

Domain **tie-break.uk** Cloudflare’de kayıtlıysa, sıradaki adımlar:

1. **Vercel** → Projeniz → **Settings** → **Domains** → **Add** → `tie-break.uk` yazın → Add.
2. Vercel size göstereceği **A** ve **CNAME** kayıtlarını not alın (örn. A: `76.76.21.21`, CNAME: `cname.vercel-dns.com`).
3. **Cloudflare** → **Websites** → **tie-break.uk** → **DNS** → **Records**:
   - **A** kaydı: Type `A`, Name `@`, IPv4 `76.76.21.21` (Vercel’in verdiği IP), Proxy **kapalı** (gri bulut).
   - **CNAME** kaydı: Type `CNAME`, Name `www`, Target `cname.vercel-dns.com`, Proxy **kapalı**.
4. Birkaç dakika bekleyin; Vercel’de domain **Valid** olunca **https://tie-break.uk** ve **https://www.tie-break.uk** sitenize gider.

---

## Önemli: Veritabanı (Database)

- Vercel sunucusuz (serverless) çalışır; **yerel SQLite veya sadece localhost’taki bir veritabanı** Vercel’de çalışmaz.
- Canlı site için:
  - **Vercel Postgres**, **PlanetScale**, **Neon**, **Supabase** gibi bulut veritabanı kullanın,
  - `.env` / Vercel Environment Variables’a `DATABASE_URL` olarak bu servisin connection string’ini yazın.

Bunları yapmadan sadece “domain nasıl değişir” derseniz:  
**Adres değişimi = projeyi Vercel’e deploy etmek + (isteğe bağlı) kendi domain’inizi Vercel’e eklemek.**  
Localhost’u “domain ile değiştirmek” ancak bu şekilde olur; tam adımlar yukarıdaki gibidir.
