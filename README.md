# ZTE Router Manager

Advanced open-source manager for the hidden API of ZTE 5G routers — band/cell
lock, carrier‑aggregation tuning, gamer mode, live monitoring, and an
auto‑optimizer. Runs on **Windows, Android, and iOS**. Everything is local: your
device talks only to your router, no cloud, no telemetry.

أداة مفتوحة المصدر للتحكم بالـ API المخفي لراوترات ZTE الـ 5G — قفل الباند/الخلية،
ضبط تجميع الترددات، وضع القيمرز، مراقبة حية، ومُحسِّن تلقائي. تشتغل على **ويندوز
وأندرويد وآيفون**. كل شي محلي: جهازك يتكلم مع راوترك فقط، بدون سحابة ولا تتبّع.

Supported: MC801A / MC801A1 / MC888 / MC889 / MC8020 and other ZTE 5G models.

---

## English

### What you can do
- **Dashboard + Live Monitor** — model, IMEI, bands, RSRP/SINR, temperature, live graphs.
- **Optimizer** with modes: 🚀 Max Speed · 🎮 Gamer (lowest ping) · ⚖️ Balance · 📶 Network (4G/5G).
- **LTE / 5G tools** — band lock, cell lock, and NR carrier‑aggregation combos (e.g. `41,78`).
- **Safe Mode** — auto‑reverts if a lock drops the connection for 60 s, plus a 🚨 restore button.
- **API Explorer / Console / Developer Mode** — auto‑discovers hidden commands.

### Get the app
| Platform | How |
| --- | --- |
| **Windows** | Prebuilt `.exe` — `release/ZTE Router Manager-win32-x64/ZTE Router Manager.exe`. Or `npm install && npm run dist:win`. |
| **Android** | Cloud build — see below (no tools to install). |
| **iOS** | Needs a Mac — see [MOBILE.md](MOBILE.md). |

### Build the Android APK in the cloud (recommended)
1. Upload this project to a GitHub repository (private is fine).
2. GitHub → **Actions** tab → **Build Android APK** → **Run workflow**.
3. Wait ~5 min → open the run → download the **`ZTE-Router-Manager-apk`** artifact → unzip → `app-debug.apk`.
4. Install it on your phone (enable *Install unknown apps*). Connect the phone to the **router's Wi‑Fi**.

### Using it
1. Open the app → enter your **router password** → tick **Remember me** → Log in.
2. For top speed: **Optimizer → 🚀 Max Speed** (unlocks everything).
3. To force fast 5G: **5G/NR → preset `n41 + n78 (CA)` → Lock** (carrier aggregation = higher speed).
4. If anything goes wrong: **🚨 Restore** (top bar) puts everything back to Auto.

### Requirements
Node 18+ (for building). Java 17 + Android SDK only if building the APK locally.

---

## العربية

### وش يسوي البرنامج
- **الرئيسية + المراقبة الحية** — الموديل، IMEI، الباندات، RSRP/SINR، الحرارة، رسوم حية.
- **المُحسِّن** بأوضاع: 🚀 الوضع السريع · 🎮 القيمرز (أقل بنق) · ⚖️ البلنس · 📶 الشبكة (4G/5G).
- **أدوات LTE / 5G** — قفل الباند، قفل الخلية، وتجميع باندات 5G (مثل `41,78`).
- **الوضع الآمن** — يرجّع تلقائيًا لو انقطع الاتصال ٦٠ ثانية بعد قفل، وزر 🚨 استعادة.
- **مستكشف/وحدة الـ API + وضع المطوّر** — يكتشف الأوامر المخفية تلقائيًا.

### كيف تحصل التطبيق
| المنصة | الطريقة |
| --- | --- |
| **ويندوز** | ملف `.exe` جاهز — `release/ZTE Router Manager-win32-x64/ZTE Router Manager.exe`. أو `npm install && npm run dist:win`. |
| **أندرويد** | بناء سحابي — تحت (بدون تثبيت أدوات). |
| **آيفون** | يحتاج ماك — [MOBILE.md](MOBILE.md). |

### بناء APK الأندرويد بالسحابة (المفضّل)
1. ارفع المشروع على مستودع **GitHub** (خاص عادي).
2. GitHub → تبويب **Actions** → **Build Android APK** → **Run workflow**.
3. انتظر ~٥ دقايق → افتح التشغيل → نزّل ملف **`ZTE-Router-Manager-apk`** → فك الضغط → `app-debug.apk`.
4. ثبّته على جوالك (فعّل «تثبيت من مصادر غير معروفة»). ووصّل الجوال بـ **واي‑فاي الراوتر**.

### كيف تستخدمه
1. افتح التطبيق → اكتب **باسورد الراوتر** → علّم **تذكّرني** → دخول.
2. لأقصى سرعة: **المُحسِّن → 🚀 الوضع السريع** (يفك كل شي).
3. لإجبار 5G السريع: **5G/NR → preset `n41 + n78 (CA)` → Lock** (التجميع = سرعة أعلى).
4. لو صار خلل: **🚨 استعادة** (الشريط العلوي) يرجّع كل شي تلقائي.

### المتطلبات
Node 18+ (للبناء). وتحتاج Java 17 + Android SDK فقط لو تبي تبني APK محليًا.

---

## Documentation / التوثيق
[MOBILE.md](MOBILE.md) · [DESKTOP.md](DESKTOP.md) · [ROADMAP.md](ROADMAP.md) ·
[KNOWN_DISCOVERIES.md](KNOWN_DISCOVERIES.md) · [docs/](docs/)

## Security / الأمان
Local‑only. No cloud. No telemetry. Your credentials and data stay on your
device and only reach your own router. · محلي فقط، بدون سحابة ولا تتبّع، وبياناتك
تبقى على جهازك وتصل راوترك فقط.

MIT License.
