# How to Test Tie Break (Step by Step)

**Türkçe:** Bu rehberde tarayıcıda ne yapacağınız ve ne görmeniz gerektiği adım adım anlatılıyor.

This guide explains exactly what to do in the browser and what you should see.

---

## Before you start

1. **Database and seed:** You must have run:
   - `npx prisma migrate dev --name init`
   - `npm run db:seed`
2. **App running:** In the project folder, run:
   ```bash
   npm run dev
   ```
3. Open your browser and go to: **http://localhost:3000**

---

## Test 1: Open the home page

1. Go to **http://localhost:3000**
2. You should see:
   - Title: **Tie Break**
   - Text: **Champions League prediction platform**
   - A blue button: **Login / Register**
3. Click **Login / Register**.

**Expected:** You are on the login page. You see **Login**, fields for **Username** and **PIN (4 digits)**, and a **Log in** button.

---

## Test 2: Log in as admin

Admin account is created by the seed script.

1. On the login page, enter:
   - **Username:** `admin`
   - **PIN:** `1234`
2. Click **Log in**.

**Expected:** You are redirected to the **Match schedule** page. At the top you see “Admin User” (or the name you gave in seed) and a **Log out** link. No 404 error.

---

## Test 3: Log out

1. On the schedule page, click **Log out**.
2. **Expected:** You are back on the **Login** page.

---

## Test 4: Wrong PIN

1. On the login page enter:
   - **Username:** `admin`
   - **PIN:** `0000`
2. Click **Log in**.

**Expected:** A red message: **Invalid username or PIN.** You stay on the login page.

---

## Test 5: Register with invite link (new user)

You need an **invite link** to register. After running `npm run db:seed`, the terminal prints something like:

```text
Invite link token: invite-xxxxxxxxxx
```

That token is your invite. The link is:

```text
http://localhost:3000/invite/invite-xxxxxxxxxx
```

(Replace `invite-xxxxxxxxxx` with the token from your terminal.)

**Steps:**

1. Copy the invite link from the seed output (e.g. `http://localhost:3000/invite/invite-abc123xyz`).
2. Paste it into the browser and open it.
3. **Expected:** You are redirected to the **Register** page (with the invite in the address bar).
4. Fill in:
   - **Name:** e.g. Test
   - **Surname:** e.g. User
   - **Username:** e.g. testuser (3–32 characters, letters/numbers/underscore)
   - **PIN:** e.g. 5678 (exactly 4 digits)
5. Click **Register**.
6. **Expected:** Green message: **Registration successful. Your account is pending approval...** and a **Back to login** link.

---

## Test 6: Pending user cannot log in

1. After registering in Test 5, click **Back to login** (or go to http://localhost:3000/login).
2. Enter the **same username and PIN** you just registered (e.g. `testuser` / `5678`).
3. Click **Log in**.

**Expected:** An amber/yellow message: **Pending approval. Your account is waiting for admin approval. You cannot log in until then.** You stay on the login page. (Admin approval is done in the admin panel, which will be built later.)

---

## Test 7: Invalid invite link

1. Go to: **http://localhost:3000/register** (no `?invite=...` in the address).
2. **Expected:** Message **Invalid invite link** or **Invalid or expired invite link** and a link back to login.

Or go to: **http://localhost:3000/invite/wrong-token-123**
3. **Expected:** **Invalid invite link** and **Back to login**.

---

## Quick checklist

| Step | What you do | What you should see |
|------|-------------|----------------------|
| 1 | Open http://localhost:3000 | Home page, “Login / Register” button |
| 2 | Click Login / Register | Login form (Username, PIN) |
| 3 | Log in with admin / 1234 | Schedule page, your name, Log out (no 404) |
| 4 | Click Log out | Back to login page |
| 5 | Open invite link from seed | Register form |
| 6 | Register new user | “Registration successful”, “Pending approval” |
| 7 | Log in with new user | “Pending approval” message, no login |

---

## If you get 404 when logging in as admin

This used to happen because the app sent admins to `/admin`, which did not exist. Now **both normal users and admins** go to **/schedule** after login. If you still see 404:

1. Stop the dev server (Ctrl+C in the terminal).
2. Run `npm run dev` again.
3. Try logging in with **admin** / **1234** again.

If 404 persists, say which URL is in the browser address bar when the error appears.
