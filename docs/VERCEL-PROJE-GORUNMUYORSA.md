# Vercel’de Projem Görünmüyor – Ne Yapmalıyım?

Proje Vercel’de listede yoksa genelde **henüz Vercel’e eklenmemiştir**. Aşağıdaki adımlarla önce kodu GitHub’a atın, sonra Vercel’de “Import” ile projeyi oluşturun.

---

## Adım 1: Projeyi GitHub’a yükleyin

Vercel, projeyi **GitHub** (veya GitLab/Bitbucket) üzerinden çeker. Önce reponuz GitHub’da olmalı.

### 1.1 GitHub’da yeni repo oluşturun

1. **https://github.com** → Giriş yapın.
2. Sağ üst **+** → **New repository**.
3. **Repository name:** `tie-break` (veya istediğiniz ad).
4. **Public** seçin.
5. **Create repository** tıklayın. (README, .gitignore eklemenize gerek yok; projede zaten var.)

### 1.2 Proje klasöründe terminal açın

Projenizin bulunduğu klasöre gidin (örn. `Tie-Break`):

```bash
cd C:\Users\e.ayvaz\Desktop\Tie-Break
```

### 1.3 Git varsa kontrol, yoksa başlatın

```bash
git status
```

- **“fatal: not a git repository”** derse:
  ```bash
  git init
  git add .
  git commit -m "Initial commit"
  ```
- Zaten repo ise sadece commit’iniz olduğundan emin olun:
  ```bash
  git add .
  git status
  git commit -m "Prepare for Vercel" 
  ```
  (Değişiklik yoksa bu adımı atlayın.)

### 1.4 GitHub’ı “remote” olarak ekleyip gönderin

**KULLANICI_ADINIZ** yerine kendi GitHub kullanıcı adınızı yazın. **tie-break** yerine az önce oluşturduğunuz repo adını yazın.

```bash
git remote add origin https://github.com/KULLANICI_ADINIZ/tie-break.git
git branch -M main
git push -u origin main
```

- GitHub kullanıcı adı/şifre (veya token) istenirse girin.
- İlk kez kullanıyorsanız GitHub’da **Settings → Developer settings → Personal access tokens** ile bir token oluşturup şifre yerine onu kullanabilirsiniz.

Bittiğinde **https://github.com/KULLANICI_ADINIZ/tie-break** adresinde projeniz görünmeli.

---

## Adım 2: Vercel’e giriş yapın ve GitHub’ı bağlayın

1. **https://vercel.com** → **Sign Up** veya **Log In**.
2. **Continue with GitHub** ile giriş yapın.
3. İlk kez bağlıyorsanız GitHub, Vercel’e “hangilerine erişebilsin?” diye sorar:
   - **All repositories** veya **Only select repositories** → `tie-break` (veya repo adınız) seçin.
   - **Install** / **Authorize** deyin.

---

## Adım 3: Vercel’de projeyi oluşturun (Import)

1. Vercel dashboard’da **Add New…** → **Project**.
2. **Import Git Repository** bölümünde **GitHub** sekmesinde `tie-break` (veya repo adınız) görünmeli. Görmüyorsanız **Adjust GitHub App Permissions** ile repoyu ekleyin.
3. Reponun yanındaki **Import**’a tıklayın.
4. **Project Name** (örn. tie-break) aynen bırakın.
5. **Environment Variables** kısmında projede kullandığınız değişkenleri ekleyin (örn. `DATABASE_URL`). Değerleri `.env` dosyanızdan kopyalayıp yapıştırın. (Veritabanı canlı ortam için uygun bir serviste olmalı.)
6. **Deploy**’e tıklayın.

Birkaç dakika sonra proje build olur ve **Dashboard**’da projeniz listelenir. Adres `https://tie-break-xxxx.vercel.app` gibi bir link olur.

---

## Hâlâ görmüyorsanız

- **Vercel Dashboard** ana sayfada sol tarafta proje listesi vardır; **All** veya **Recent**’e bakın.
- **Add New… → Project** ile yeni proje ekleme ekranına gidin; orada **Import** edilmiş repolar görünür.
- GitHub’da repoyu **private** yaptıysanız, Vercel’in GitHub uygulamasında o reponun seçili olduğundan emin olun (GitHub → Settings → Applications → Vercel → Repository access).

Bu adımları tamamladıktan sonra proje Vercel’de görünür; ardından **Settings → Domains**’ten **tie-break.uk** ekleyebilirsiniz.
