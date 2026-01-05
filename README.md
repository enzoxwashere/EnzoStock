#  Enzo Stock Bot

بوت Discord لبيع المنتجات الرقمية باستخدام ProBot Credits.

![Discord](https://img.shields.io/badge/Discord-Bot-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

## ✨ المميزات

- 🛒 **نظام شراء تلقائي** - يتعرف على تحويلات ProBot
- 💳 **دعم ProBot Credits** - الدفع عبر ProBot
- 📦 **إدارة المخزون** - إضافة/حذف المنتجات والفئات
- 🔐 **أوامر للمالك فقط** - حماية أوامر الإدارة
- 📊 **عرض جميل للمخزون** - Embeds منسقة
- ➕ **إضافة منتجات متعددة** - كل سطر = منتج

---

## 📋 الأوامر

### للجميع:
| الأمر |    الوصف        |
|----------|------------|
| `$stock` | عرض المخزون |
| `$buy`   | شراء منتج    |
| `$help`  | عرض المساعدة|

### للمالك:
| الأمر | الوصف |
|-------|-------|
| `$add-category <id> <name> <emoji> <price>` | إضافة فئة جديدة |
| `$delete-category <id>` | حذف فئة |
| `$set-price <id> <price>` | تغيير سعر فئة |
| `$add-product <id> <product>` | إضافة منتج |
| `/add-product` | إضافة منتجات متعددة (Modal) |

---

## 🚀 التثبيت

### 1. Clone المشروع:
```bash
git clone https://github.com/yourusername/enzo-stock.git
cd enzo-stock
```

### 2. تثبيت المتطلبات:
```bash
npm install
```

### 3. إعداد `.env`:
```env
TOKEN=توكن_البوت
CLIENT_ID=آيدي_البوت
OWNER_ID=آيدي_المالك
```

### 4. إعداد `config.json`:
```json
{
    "recipient": "آيدي_مستلم_الكريديت",
    "probotId": "282859044593598464",
    "shopName": "اسم المتجر",
    "creditEmoji": "<a:ProBot:1455561364452937911>",
    "feedbackChannel": "آيدي_قناة_التقييمات"
}
```

### 5. تسجيل الأوامر وتشغيل البوت:
```bash
npm run deploy
npm start
```

---

## 📁 هيكل المشروع

```
EnzoStock/
├── 📂 commands/
│   ├── buy.js
│   ├── stock.js
│   ├── add-category.js
│   ├── add-product.js
│   ├── delete-category.js
│   └── set-price.js
├── 📄 config.json
├── 📄 database.json
├── 📄 index.js
├── 📄 deploy.js
└── 📄 package.json
```

---

## ⚙️ الإعدادات

| الإعداد | الوصف |
|---------|-------|
| `recipient` | آيدي المستخدم الذي يستلم الكريديت |
| `probotId` | آيدي ProBot (لا تغيره) |
| `shopName` | اسم متجرك |
| `creditEmoji` | إيموجي الكريديت |
| `feedbackChannel` | آيدي قناة التقييمات |

---

## 📝 License

MIT License - [LICENSE](LICENSE)

---

## 👤 Author

**Enzo** - [@0xenzox](https://discord.com)

---

⭐ **Star this repo if you find it useful!**
