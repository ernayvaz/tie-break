# Halisaha Admin Checklist

Bu dosya Halisaha Admin System implementasyonu boyunca kabul kriterlerini takip etmek icin kullanilir.

## Data Model

- [x] `HalisahaMatch` modeli eklendi.
- [x] `HalisahaParticipant` modeli eklendi.
- [x] `HalisahaQuestion` modeli eklendi.
- [x] `HalisahaQuestionOption` modeli eklendi.
- [x] `HalisahaAnswer` modeli eklendi.
- [x] Prisma migration olusturuldu.
- [x] Prisma client guncellendi.

## Admin Area

- [x] Admin nav icine `Halisaha` baglantisi eklendi.
- [x] `/admin/halisaha` sayfasi olusturuldu.
- [x] Tek aktif Halisaha macini olusturma/guncelleme akisi calisiyor.
- [x] Takim adlari, mekan ve kickoff admin tarafindan duzenlenebiliyor.
- [x] Kayitli kullanicilar maca eklenebiliyor.
- [x] Guest oyuncular maca eklenebiliyor.
- [x] Oyuncularin takim ve mevki atamalari yapilabiliyor.
- [x] Sorular eklenebiliyor.
- [x] Sorular duzenlenebiliyor.
- [x] Sorular silinebiliyor.
- [x] Her soru icin secenekler ve puan ayarlanabiliyor.
- [x] Mac bitince dogru cevaplar admin tarafindan belirlenebiliyor.
- [x] Cevaplar puanlanabiliyor.
- [x] Admin aksiyonlari audit log'a dusuyor.

## Public Halisaha Page

- [x] Halisaha sayfasi DB verisiyle besleniyor.
- [x] Takim isimleri admin verisinden geliyor.
- [x] Mekan admin verisinden geliyor.
- [x] Kickoff ve countdown Istanbul saatine gore hesaplanıyor.
- [x] Oyuncular ve guestler admin atamalarina gore gorunuyor.
- [x] RayNET Matchday Show tabi calisiyor.
- [x] Tahminler yalnizca Matchday sekmesinde (orta saha topu ile) acilir; ayri Match Challenge sekmesi yok.
- [x] Leaderboard tabi calisiyor.
- [x] Leaderboard tabi mevcut leaderboard verisini kullaniyor.
- [x] Leaderboard kolon basliklari Halisaha baglamina uygun adlandirildi.

## Questions And Answers

- [x] Sorular Matchday sahasinda top ile acilan overlay'de gosteriliyor.
- [x] Sorular saha gorseli uzerinde overlay olarak gosteriliyor.
- [x] Pinned `Kim kazanir?` sorusu ust winner strip alaninda gosteriliyor.
- [x] Standart sorular sahanin sol ve sag kanatlarina ayriliyor.
- [x] Standart soru secenekleri yatay pill butonlar olarak gosteriliyor.
- [x] Her soruda tek secim yapilabiliyor.
- [x] Kullanici cevaplari kaydediliyor.
- [x] Tek global `Save Answer` butonu ile staged cevaplar toplu kaydediliyor.
- [x] Winner strip yuzdeleri kaydedilen toplam oy dagilimina gore guncelleniyor.
- [x] Cozumleme sonrasi dogru/yanlis durumlari hesaplanıyor.
- [x] Soru puanlari gosteriliyor.
- [x] Toplam puan veya kazanan ozeti gosterilebiliyor.

## Flexibility

- [x] Soru alani sonraki yer degisikligine uygun sekilde component bazli kuruldu.
- [x] Gorsel alani sonraki yer degisikligine uygun sekilde esnek bir yapiyla kuruldu.

## Verification

- [x] Admin akislari manuel test edildi.
- [x] Kullanici cevap akisi manuel test edildi.
- [x] Winner strip, protected midfield lane ve global save akisi browser uzerinde dogrulandi.
- [x] Halisaha tab gecisleri manuel test edildi.
- [x] Lint kontrolu temiz.
- [x] Production build temiz.

Not:
- Admin `admin / 1234` oturumu ile `/admin/halisaha` sayfasina giris yapildi.
- Match setup kaydi, guest ekleme, kayitli oyuncu ekleme, takim/mevki atama, soru olusturma, dogru cevap belirleme ve `Score all answers` akislari DB loglariyla dogrulandi.
- Public Matchday'de top ile acilan soru overlay'i, cevap secimi ve `Save answer` akisi browser testinde dogrulandi.
- Kaydedilen cevap tekrar acilan overlay'de ve admin panelindeki `1 answer(s)` bilgisinde goruldu.
- Winner strip `Kim kazanir?` sorusu otomatik olarak olusturuldu, takim isimleriyle senkron kaldi ve browser testinde `0%` -> `100%` oy guncellemesi goruldu.
- Tahmin overlay'inde orta saha koridorunun bos kaldigi, standart sorularin kanatlara yerlestigi ve alt bilgi kartlarinda `Questions`, `Total Point`, `Your Answer`, `Your Point` alanlarinin gorundugu dogrulandi.
