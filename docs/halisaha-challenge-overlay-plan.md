# Halisaha Challenge Overlay Plan Ve Durum Kontrolu

Bu dosya, kullanicinin `slicerlar acildiktan sonraki` 6 talebini tek bir yerde netlestirmek, kabul kriterlerini sabitlemek ve mevcut implementasyonun hangi maddeleri sorunsuz tamamladigini gostermek icin olusturuldu.

## Kapsam

Bu plan sadece Matchday'de top ile acilan saha ustundeki tahmin overlay deneyimini kapsar.

Kapsam disi:
- Matchday tabinin kapali durum tasarimi
- Genel leaderboard tasarimi
- Oyuncu dizilislerinin saha uzerindeki klasik lineup gorunumu

## Kullanici Talepleri

### 1. Soru ve secenek yerlesimi

Kullanici, cizimde sorularin ve seceneklerin nerede ve hangi sirayla olacagini tarif etti.

Beklenen sonuc:
- Overlay icindeki soru yapisi tek sutun veya alt panel mantigiyla akmayacak.
- Sorular saha uzerinde yasayacak.
- Yerlesim, cizimdeki mantiga uygun sekilde ust winner alani + sol kanat + sag kanat olarak ayrilacak.

### 2. Iki ayri soru alani ve yatay secenekler

Beklenen sonuc:
- Sorular iki ana kisimda gorunecek.
- Secenekler dikey liste degil, yatay satirda yan yana `pill` secimler olarak gosterilecek.

### 3. Ust winner strip, logolar ve dolan yuzde barlari

Beklenen sonuc:
- En ustte ortada iki takim logosu olacak.
- Bunun saginda ve solunda `Kim kazanir?` sorusuna ait oy dagilimi gorunecek.
- Kullanici secim yaptikca ilgili taraf vurgulanacak.
- Kayitli tum oylar uzerinden yuzde degeri gorunecek.
- Bar gecisleri premium ve akici hissettirecek.

### 4. Orta saha koridoru dokunulmaz kalacak

Beklenen sonuc:
- Orta saha cizgisi, orta saha cemberi ve top butonunun oldugu koridora soru, cevap, bilgi kutusu ya da baska bir katman yerlestirilmeyecek.
- Bu koridorun gorsel butunlugu bozulmayacak.
- Challenge overlay acikken de ayni merkez hissi korunacak.

### 5. Sorularin altinda `Save Answer`

Beklenen sonuc:
- Kullanici secimlerini yaptiktan sonra tek ve net bir `Save Answer` aksiyonu gorecek.
- Kayit akisi daginik hissettirmeyecek.

### 6. Save altinda kullanici bilgilendirme alani

Beklenen sonuc:
- `Questions`
- `Total Point`
- `Your Answer`
- `Your Point`

Bu dort alan acikca gosterilecek.

`Your Point` anlami:
- Kullanici su ana kadar cevapladigi sorular dogru cikarsa alabilecegi maksimum puan.
- Cozumleme oncesi optimistic ust sinir mantigiyla hesaplanacak.

## Teknik Plan

### UI Yerlesim Plani

Overlay 3 ana bolgeye ayrilir:

1. Ust winner strip
- Sol taraf: home takim oy bari
- Orta: logolar
- Sag taraf: away takim oy bari

2. Saha uzeri soru kanatlari
- Sol kanat: ilk grup standart sorular
- Sag kanat: ikinci grup standart sorular
- Standart sorular otomatik dagitilir

3. Alt kontrol ve ozet alani
- Tek global `Save Answer`
- Basari/hata geri bildirimi
- 4 adet bilgi kutusu

### Veri Plani

Winner alani standart sorulardan ayrilmak zorundaydi. Bunun icin:
- `HalisahaQuestionKind` enumu eklendi
- `winner` ve `standard` ayrimi tanimlandi
- Public snapshot artik:
  - `winnerQuestion`
  - `winnerVoteSummary`
  - `standardQuestions`
  donuyor

### Admin Plani

Admin panelinde:
- Tam olarak bir adet pinned `winner` sorusu bulunur
- Bu soru silinemez
- Bu sorunun secenekleri home ve away takim isimleriyle senkron kalir
- Prompt ve puan ayarlanabilir

### Kaydetme Plani

Per-question save yerine:
- overlay icinde secimler once staged tutulur
- sonra tek seferde `Save Answer` ile toplu kaydedilir

## Kabul Kriterleri

- [x] Winner strip saha overlay'inin en ustunde sabit bir blok olarak gorunur.
- [x] Winner strip ortasinda logolar bulunur.
- [x] Winner strip sag ve solunda oy dagilimini gosteren barlar vardir.
- [x] Barlar yuzde degeri gosterir.
- [x] Standart sorular iki ayri saha kanadina dagitilir.
- [x] Standart soru secenekleri yatay pill yapidadir.
- [x] Midfield lane bos kalir.
- [x] Midfield line ve cember challenge acikken de gorunur.
- [x] Tek global `Save Answer` butonu vardir.
- [x] `Questions`, `Total Point`, `Your Answer`, `Your Point` alanlari gorunur.

## Durum Kontrolu

### 1. Soru ve secenek yerlesimi
- Durum: [x] Sorunsuz tamamlandi
- Kontrol sonucu:
  - Overlay saha uzerinde yasiyor.
  - Yerlesim ust strip + sol kanat + sag kanat mantigina ayrildi.
  - Standart sorular artik alt panelde degil.

### 2. Iki ayri soru alani ve yatay secenekler
- Durum: [x] Sorunsuz tamamlandi
- Kontrol sonucu:
  - Standart sorular iki kanada ayrildi.
  - Soru secenekleri yatay `pill` secimlere donusturuldu.

### 3. Ustte logolar ve kullanici oyuna gore dolan yuzde barlari
- Durum: [x] Sorunsuz tamamlandi
- Kontrol sonucu:
  - `Kim kazanir?` sorusu winner strip icine alindi.
  - Barlar aggregate saved votes uzerinden yuzde gosteriyor.
  - Browser dogrulamasinda `0%` ve `100%` durumlari calisti.

### 4. Orta saha koridorunun bos kalmasi
- Durum: [x] Sorunsuz tamamlandi
- Kontrol sonucu:
  - Soru kartlari orta saha koridoruna yerlestirilmiyor.
  - Overlay icinde orta cizgi ve orta cember tekrar ciziliyor.
  - Top butonu merkez odagi olarak korunuyor.

### 5. Sorularin altinda `Save Answer`
- Durum: [x] Sorunsuz tamamlandi
- Kontrol sonucu:
  - Tek global `Save Answer` butonu overlay alt bolgesinde yer aliyor.
  - Kullanici secimleri staged tutulup tek seferde kaydediliyor.

### 6. Save altinda kullanici bilgilendirme alani
- Durum: [x] Sorunsuz tamamlandi
- Kontrol sonucu:
  - `Questions`
  - `Total Point`
  - `Your Answer`
  - `Your Point`
  alanlari alt kisimda gosteriliyor.
  - `Your Point`, cevaplanan sorularin maksimum alabilecegi puana gore hesaplaniyor.

## Kanit Olarak Kontrol Edilen Alanlar

- `src/components/halisaha/halisaha-challenge-overlay.tsx`
- `src/components/halisaha/halisaha-question-card.tsx`
- `src/app/(app)/halisaha/actions.ts`
- `src/lib/halisaha/server.ts`
- `src/app/admin/halisaha/actions.ts`
- `src/app/admin/halisaha/halisaha-admin-client.tsx`
- `docs/halisaha-admin-checklist.md`

## Sonuc

Bu 6 talebin tamami mevcut implementasyonda karsilanmis durumda.

Ek not:
- Su anki yapi, kullanicinin istedigi premium saha ustu challenge deneyimini veriyor.
- Bir sonraki asamada istenirse soru bloklarina manuel admin konumlandirma sistemi eklenebilir; ancak bu 6 talebin tamamlanmasi icin zorunlu degildir.
