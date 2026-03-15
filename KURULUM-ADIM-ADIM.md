# Tie Break – Baştan Sona Kurulum Rehberi

Bu rehberde her şeyi hiç bilmiyormuşsunuz gibi tek tek anlatıyorum. Sırayla gidin.

---

## Bölüm 1: Terminali açmak

**Terminal** = Bilgisayara komut yazdığınız siyah/beyaz penceredir.

### Windows’ta nasıl açılır?

**Yöntem A (önerilen)**  
1. Klavyede **Windows tuşu**na basın (Ctrl ile Alt arasındaki tuş).  
2. Arama kutusuna **`cmd`** veya **`powershell`** yazın.  
3. Çıkan **“Komut İstemi”** veya **“Windows PowerShell”**e tıklayın.  
4. Açılan pencere = Terminal.

**Yöntem B**  
1. Proje klasörünü açın: **Bu Bilgisayar** → **Masaüstü** → **Tie-Break** klasörüne çift tıklayın.  
2. Klasörün içindeyken adres çubuğuna **`cmd`** yazıp Enter’a basın.  
3. Terminal o klasörde açılır.

**Kontrol:** Pencerede şuna benzer bir satır görürsünüz:  
`C:\Users\e.ayvaz\Desktop\Tie-Break>`  
Bu, doğru klasörde olduğunuz anlamına gelir.

---

## Bölüm 2: Proje klasörüne geçmek

Eğer terminal başka bir yerde açıldıysa:

1. Şunu yazın (sonunda Enter’a basın):  
   ```  
   cd c:\Users\e.ayvaz\Desktop\Tie-Break  
   ```  
2. Enter’a basın.  
3. Satırın sonunda `Tie-Break>` görünüyorsa doğru klasördesiniz.

---

## Bölüm 3: Node.js kurulu mu kontrol etmek

1. Terminalde şunu yazıp Enter’a basın:  
   ```  
   node -v  
   ```  
2. Bir **sürüm numarası** (örn. `v20.10.0`) görürseniz Node kurulu demektir.  
3. “Tanınmıyor” gibi bir hata alırsanız Node.js’i kurmanız gerekir:  
   - Tarayıcıda **https://nodejs.org** açın.  
   - **LTS** yazan yeşil butona tıklayıp indirin.  
   - Kurulumu tamamlayın, bilgisayarı yeniden başlatın, sonra tekrar **Adım 1**den devam edin.

---

## Bölüm 4: Bağımlılıkları yüklemek

“Bağımlılık” = Projenin ihtiyaç duyduğu hazır kod paketleri. Bunları tek komutla indiriyoruz.

1. Terminalde proje klasöründe olduğunuzdan emin olun (`Tie-Break>` görünüyor olmalı).  
2. Şunu **aynen** yazıp Enter’a basın:  
   ```  
   npm install --legacy-peer-deps  
   ```  
3. Bir süre bekleyin (1–3 dakika sürebilir).  
4. En sonda **“added XXX packages”** gibi bir satır görürseniz işlem tamamdır.  
5. Hata mesajı çıkarsa: Önce **Bölüm 3**teki Node kontrolünü yapın; hâlâ hata varsa mesajın tamamını bir yere kopyalayıp saklayın.

---

## Bölüm 5: Neon’da ücretsiz veritabanı açmak

Neon = İnternet üzerinde çalışan ücretsiz PostgreSQL veritabanı. Hiç SQL bilmeden, sadece site üzerinden hesap açıp link alacaksınız.

### 5.1 Siteye girmek ve kayıt olmak

1. Tarayıcıda **https://neon.tech** adresini açın.  
2. Sağ üstte **“Sign up”** veya **“Get started”** butonuna tıklayın.  
3. **“Continue with Google”** veya **“Sign up with Email”** seçin.  
   - Google seçerseniz: Google hesabınızla giriş yapın.  
   - E-posta seçerseniz: E-posta ve şifre girin, gelen doğrulama linkine tıklayın.  
4. Giriş yaptıktan sonra Neon’un ana sayfasına (dashboard) düşeceksiniz.

### 5.2 Yeni proje oluşturmak

1. Ekranda **“Create a project”** veya **“New project”** yazan büyük butonu bulun, tıklayın.  
2. **“Project name”** kutusuna örneğin şunu yazın: **`tiebreak`**  
   (Küçük harf, boşluksuz. İsterseniz başka isim de yazabilirsiniz.)  
3. **“Create project”** veya **“Create”** butonuna tıklayın.  
4. Birkaç saniye sonra proje açılır; yeni bir sayfa veya panel görürsünüz.

### 5.3 Bağlantı adresini (connection string) kopyalamak

1. Açılan sayfada **“Connection string”**, **“Connect”** veya **“Connection details”** gibi bir bölüm arayın.  
2. Genelde **“URI”** veya **“Connection string”** yazan bir kutu vardır; içinde şöyle bir metin olur:  
   ```  
   postgresql://kullanici_adi:uzun_sifre@ep-xxxx-xxxx.region.aws.neon.tech/neondb?sslmode=require  
   ```  
3. Bu kutunun yanındaki **kopyalama ikonuna** (iki sayfa/copy simgesi) tıklayın.  
   Veya metni mouse ile seçip **Ctrl+C** ile kopyalayın.  
4. Bu metni **Not Defteri**ne yapıştırıp kaydedin (Ctrl+V). Sonraki adımda kullanacaksınız.  
   Önemli: Başında `postgresql://` olmalı, sonunda `?sslmode=require` olabilir. Tüm satır tek parça olmalı.

---

## Bölüm 6: `.env` dosyasını bulmak ve düzenlemek

`.env` = Projenin şifre ve adreslerini tutan gizli ayar dosyası. Bu dosyaya veritabanı adresinizi yazacağız.

### 6.1 Dosyayı nerede bulacaksınız?

1. **Bu Bilgisayar** → **Masaüstü** → **Tie-Break** klasörünü açın.  
2. İçinde **`.env`** adında bir dosya göreceksiniz.  
   - Görünmüyorsa: Klasörde **“Görünüm”** sekmesine gidin, **“Gizli öğeler”** kutusunu işaretleyin.  
   - Yine yoksa: **`.env.example`** dosyasını kopyalayıp yapıştırın, kopyanın adını **`.env`** yapın.

### 6.2 Dosyayı hangi programla açacaksınız?

- **Cursor / VS Code** kullanıyorsanız: Sol taraftan **Tie-Break** projesini açın, soldaki dosya listesinde **`.env`**e tıklayın.  
- Başka metin editörü (Not Defteri, Notepad++ vb.) ile açacaksanız: **Tie-Break** klasöründeki **`.env`** dosyasına sağ tıklayın → **Birlikte Aç** → **Not Defteri** (veya kullandığınız editör).

### 6.3 İçeriği nasıl düzenleyeceksiniz?

Dosyada buna benzer satırlar vardır:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require"
SESSION_SECRET="your-session-secret-min-32-chars"
```

**Yapmanız gerekenler:**

1. **DATABASE_URL satırı:**  
   - Tırnak içindeki kısmı **silin**.  
   - Yerine **Bölüm 5.3**te kopyaladığınız Neon adresini **yapıştırın**.  
   - Sonuç şöyle olmalı (sizin adresiniz farklı olacak):  
     ```env  
     DATABASE_URL="postgresql://neon_user:AbCdEf123@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"  
     ```  
   - Tırnakları silmeyin; sadece tırnakların **içindeki** metni değiştirin.

2. **SESSION_SECRET satırı:**  
   - Tırnak içindeki kısmı silin.  
   - En az **32 karakter** uzunluğunda rastgele bir metin yazın. Örnek:  
     ```env  
     SESSION_SECRET="tiebreak-benim-gizli-anahtarim-12345"  
     ```  
   - Türkçe karakter kullanmayın; sadece harf, rakam ve tire kullanın.

3. Dosyayı **kaydedin** (Ctrl+S).  
4. Dosyayı kapatın.

---

## Bölüm 7: Veritabanı tablolarını oluşturmak

Tabloları siz SQL yazarak oluşturmuyorsunuz; Prisma bunu sizin için yapacak.

1. Terminali açın (Bölüm 1’e bakın).  
2. Proje klasöründe olduğunuzdan emin olun; değilseniz şunu yazın:  
   ```  
   cd c:\Users\e.ayvaz\Desktop\Tie-Break  
   ```  
3. Şu komutu **aynen** yazıp Enter’a basın:  
   ```  
   npx prisma migrate dev --name init  
   ```  
4. İlk seferde “Prisma schema’yı uygulayalım mı?” gibi bir şey sorabilir; **y** yazıp Enter’a basın.  
5. İşlem bitince **“Applied migration”** veya benzeri bir mesaj görürsünüz. Tablolar Neon’da oluşmuş demektir.

**Hata alırsanız:**  
- “Can’t reach database” → `.env` içindeki `DATABASE_URL`’i kontrol edin; Neon’dan kopyaladığınız adresin tamamı orada mı, tırnak içinde mi?  
- Başka hata → Terminaldeki hata mesajının tamamını kopyalayıp saklayın.

---

## Bölüm 8: Başlangıç verisini yüklemek (admin hesabı)

Bu adım **isteğe bağlı**. Yaparsanız giriş için bir admin hesabı (kullanıcı adı: **admin**, PIN: **1234**) oluşur.

1. Terminalde proje klasöründe olduğunuzdan emin olun.  
2. Şunu yazıp Enter’a basın:  
   ```  
   npm run db:seed  
   ```  
3. “Admin user: admin” ve “Prizes created” gibi satırlar görürseniz işlem tamamdır.

---

## Bölüm 9: Uygulamayı çalıştırmak

1. Terminalde proje klasöründe olun.  
2. Şunu yazıp Enter’a basın:  
   ```  
   npm run dev  
   ```  
3. Bir süre sonra şuna benzer bir satır görürsünüz:  
   ```  
   - Local: http://localhost:3000  
   ```  
4. Tarayıcıyı açın, adres çubuğuna **http://localhost:3000** yazıp Enter’a basın.  
5. Tie Break ana sayfası açılır. **“Giriş / Kayıt”** linkine tıklayarak giriş sayfasına gidebilirsiniz.  
   - Seed yüklediyseniz: Kullanıcı adı **admin**, PIN **1234** ile (giriş formu sonraki fazlarda tamamlanacak).

**Uygulamayı durdurmak için:** Terminal penceresinde **Ctrl+C** tuşlarına basın.

---

## Özet kontrol listesi

- [ ] Terminali açtım (Bölüm 1)  
- [ ] `cd c:\Users\e.ayvaz\Desktop\Tie-Break` ile proje klasörüne geçtim (Bölüm 2)  
- [ ] `node -v` ile Node.js’in kurulu olduğunu gördüm (Bölüm 3)  
- [ ] `npm install --legacy-peer-deps` çalıştırdım (Bölüm 4)  
- [ ] neon.tech’te hesap açıp proje oluşturdum (Bölüm 5)  
- [ ] Connection string’i kopyaladım (Bölüm 5.3)  
- [ ] `.env` dosyasında DATABASE_URL ve SESSION_SECRET’ı düzenledim (Bölüm 6)  
- [ ] `npx prisma migrate dev --name init` çalıştırdım (Bölüm 7)  
- [ ] (İsteğe bağlı) `npm run db:seed` çalıştırdım (Bölüm 8)  
- [ ] `npm run dev` çalıştırıp http://localhost:3000 açtım (Bölüm 9)

Takıldığınız adımı bu rehberdeki ilgili bölüm numarasıyla birlikte yazarsanız, o adıma özel yardım alabilirsiniz.
