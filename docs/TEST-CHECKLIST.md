# Faz 19: Manuel Test ve Kabul Kontrolü Checklist

Bu doküman, Tie-Break uygulamasının manuel kabul testleri için kullanılır. Her maddeyi test edip geçtiğinde işaretleyin.

---

## 1. Ortam ve Kurulum

| # | Adım | Beklenen | ✓ |
|---|------|----------|---|
| 1.1 | `npm install` hatasız tamamlanır | Bağımlılıklar yüklenir | |
| 1.2 | `.env` içinde `DATABASE_URL` tanımlı | Uygulama DB'ye bağlanır | |
| 1.3 | `npm run db:push` veya `db:migrate` çalışır | Şema güncel | |
| 1.4 | `npm run db:seed` çalışır | Admin, prize, invite link oluşur | |
| 1.5 | `npm run build` hatasız tamamlanır | Production build başarılı | |
| 1.6 | `npm run test:run` tüm testleri geçer | 27 unit test (auth, validation, prediction-values) | |

---

## 2. Kimlik Doğrulama ve Oturum

| # | Adım | Beklenen | ✓ |
|---|------|----------|---|
| 2.1 | `/login` sayfası açılır | Username + PIN alanları, Login butonu | |
| 2.2 | Geçersiz PIN ile giriş | Hata mesajı, oturum açılmaz | |
| 2.3 | Yanlış kullanıcı adı | Hata mesajı | |
| 2.4 | Pending/Rejected kullanıcı ile giriş | Uygun mesaj (onay bekliyor / reddedildi) | |
| 2.5 | Doğru admin (örn. PIN 1234) ile giriş | `/admin` veya yönlendirme, admin menüsü | |
| 2.6 | Doğru normal kullanıcı ile giriş | `/schedule` veya ana sayfa | |
| 2.7 | Logout | Oturum kapanır, login sayfasına yönlendirme | |
| 2.8 | Invite link ile `/invite/[token]` | Kayıt formu veya “link expired” | |
| 2.9 | Kayıt: geçersiz form (kısa username, 4 haneli olmayan PIN) | Validasyon hataları gösterilir | |
| 2.10 | Kayıt: geçerli form | “Pending approval” mesajı, kullanıcı DB’de | |
| 2.11 | Rate limit: login’de 5+ hatalı deneme | Kısıtlama mesajı | |
| 2.12 | Rate limit: register’da 10+ deneme | Kısıtlama mesajı | |

---

## 3. Schedule (Maç Listesi ve Tahmin)

| # | Adım | Beklenen | ✓ |
|---|------|----------|---|
| 3.1 | Schedule sayfası açılır | Upcoming / Past sekmeleri, lig sekmeleri (UCL / Diğer) | |
| 3.2 | Maç yoksa | “No matches yet” veya benzeri boş durum | |
| 3.3 | Maç varsa listelenir | Tarih, stage, ev/deplasman takımlar, lock saati | |
| 3.4 | Lock öncesi: 1 / X / 2 seçimi | Seçim yapılabilir, Finalize butonu | |
| 3.5 | Finalize tıklanınca | Onay modalı (“Are you sure?”) | |
| 3.6 | Finalize onayı | “Your pick: 1/X/2”, “Finalized at …” | |
| 3.7 | Maç sonrası: “Others’ predictions (N)” | Açılır liste: kullanıcı adı, tahmin, finalized_at | |
| 3.8 | Undo (maç sonucu yokken) | Tahmin geri alınır, tekrar seçim yapılabilir | |
| 3.9 | Admin: geçmiş maçta Undo | Admin geçmiş maçta da tahmini geri alabilir | |
| 3.10 | Admin: “Reset all my predictions (upcoming)” | Sadece gelecek maçlardaki finalize tahminler sıfırlanır | |
| 3.11 | Admin: “Reset all my predictions (past)” | Sadece geçmiş maçlardaki finalize tahminler sıfırlanır | |
| 3.12 | Filtreler: Stage, Team | Liste filtrelenir, “Showing X of Y” güncellenir | |

---

## 4. Leaderboard

| # | Adım | Beklenen | ✓ |
|---|------|----------|---|
| 4.1 | Leaderboard sayfası açılır | Sıra, İsim, Puan, Tahmin sayısı, Tamamlanan maç, Accuracy | |
| 4.2 | En az 1 finalize tahmini olan kullanıcılar listelenir | Sıralama: puan DESC, accuracy DESC | |
| 4.3 | Ödüller (1–2–3) gösterilir | Prize tablosundan place, title, description | |
| 4.4 | Finalize / sonuç girişi sonrası | Sayfa yenilenince leaderboard güncel | |
| 4.5 | Admin olarak giriş | Admin leaderboard’da en altta veya ayrı gösterilir | |

---

## 5. My Predictions

| # | Adım | Beklenen | ✓ |
|---|------|----------|---|
| 5.1 | My Predictions sayfası açılır | Maç, seçim (1/X/2), finalized, finalized_at | |
| 5.2 | Maç bittiyse | Doğru/yanlış + resmi sonuç gösterilir | |
| 5.3 | Filtreler: Status (All / Finalized / Draft / Match completed / Match pending), Outcome (All / Correct / Incorrect) | Liste filtrelenir | |
| 5.4 | Undo (maç sonucu yokken) | Tahmin geri alınır | |
| 5.5 | “Reset all my predictions” | Sonucu girilmemiş tüm tahminler sıfırlanır | |

---

## 6. Rules & Prizes

| # | Adım | Beklenen | ✓ |
|---|------|----------|---|
| 6.1 | Rules & Prizes sayfası açılır | 1/X/2 ve X açıklaması, lock, puanlama, tie-break, ödüller | |

---

## 7. Admin – Genel

| # | Adım | Beklenen | ✓ |
|---|------|----------|---|
| 7.1 | Admin olmayan kullanıcı `/admin` açar | Erişim reddedilir veya yönlendirme | |
| 7.2 | Admin sidebar: Dashboard, User Management, Match Management, Prediction Management, Scoring, API & Sync, Invite link, Audit Log | Tüm linkler çalışır, aktif sayfa vurgulanır | |

---

## 8. Admin – User Management

| # | Adım | Beklenen | ✓ |
|---|------|----------|---|
| 8.1 | Kullanıcı listesi | Status filtresi: All / Pending / Approved / Rejected / Blocked | |
| 8.2 | Pending kullanıcıya Approve | status → approved, kullanıcı giriş yapabilir | |
| 8.3 | Pending kullanıcıya Reject | status → rejected, oturumlar silinir | |
| 8.4 | Onaylı kullanıcıya Block | status → blocked, oturumlar silinir | |
| 8.5 | Blocked kullanıcıya Unblock | status → approved | |
| 8.6 | Username güncelleme | Modal, unique kontrolü, AdminLog | |
| 8.7 | PIN sıfırlama | Modal, 4 hane, hash’lenip kaydedilir, AdminLog | |

---

## 9. Admin – Match Management

| # | Adım | Beklenen | ✓ |
|---|------|----------|---|
| 9.1 | Maç listesi | Tarih, stage, ev/deplasman, lock, skor, result; League filtresi (All / UCL / Diğer), Stage, Time (All / Upcoming / Past) | |
| 9.2 | Set result | 1/X/2 + isteğe bağlı skor; kayıt sonrası scoreMatch + leaderboard güncellenir | |
| 9.3 | Create match | Stage, tarih, takımlar, lockAt; sourceStatus = manual | |
| 9.4 | Edit match | Tüm alanlar düzenlenebilir; result değişirse puanlama güncellenir | |
| 9.5 | Delete match | Onay modalı; tahminler silinir, AdminLog | |

---

## 10. Admin – Prediction Management

| # | Adım | Beklenen | ✓ |
|---|------|----------|---|
| 10.1 | Tahmin listesi | Match, User, Pick, Status, Finalized at, Result, Points | |
| 10.2 | Filtreler: League (All / UCL / Diğer), Match, User, Status (All / Finalized / Draft) | Liste ve Match dropdown filtrelenir | |
| 10.3 | Finalize tahminlerde “Set 0” / “Set 1” | Puan güncellenir, rebuildLeaderboard, AdminLog | |

---

## 11. Admin – Scoring

| # | Adım | Beklenen | ✓ |
|---|------|----------|---|
| 11.1 | “Recalculate scores & leaderboard” | Tüm maçlar puanlanır, leaderboard yenilenir | |
| 11.2 | Prediction Management’tan “Recalculate all scores & leaderboard” linki | Scoring sayfasına gider | |

---

## 12. Admin – API & Sync

| # | Adım | Beklenen | ✓ |
|---|------|----------|---|
| 12.1 | “Sync matches” butonu | football-data.org’dan maçlar çekilir, ApiSyncLog kaydı | |
| 12.2 | Sync sonrası | Recalculate otomatik çalışır (veya kullanıcı Scoring’den çalıştırır) | |
| 12.3 | API sync log listesi | Son kayıtlar görünür | |

---

## 13. Admin – Invite Link

| # | Adım | Beklenen | ✓ |
|---|------|----------|---|
| 13.1 | Yeni invite link oluşturma | Token oluşur, kopyalama mümkün | |
| 13.2 | Link ile `/invite/[token]` | Kayıt sayfasına yönlendirme | |

---

## 14. Admin – Audit Log

| # | Adım | Beklenen | ✓ |
|---|------|----------|---|
| 14.1 | Audit log listesi | Date, Admin, Action, Target, Old value, New value (son 200) | |
| 14.2 | Filtreler: Action type, Target type | Liste filtrelenir; “Clear filters” | |
| 14.3 | User/Match/Prediction aksiyonları | AdminLog’da ilgili kayıtlar oluşur | |

---

## Özet

- **Otomatik testler:** `npm run test:run` — auth/pin, prediction-values, validation/auth (27 test).
- **Manuel checklist:** Yukarıdaki maddeleri sırayla test edin; her biri için ✓ koyun.
- **Kabul kriteri:** Kritik akışlar (giriş, tahmin, finalize, leaderboard, admin CRUD ve sonuç girişi) hatasız çalışmalı; otomatik testler yeşil olmalı.

Bu doküman Faz 19 (Test ve Kabul Kontrolü) kapsamında hazırlanmıştır.
