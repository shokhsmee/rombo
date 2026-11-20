// Qo'llanma → Boshlash: signing in, the menu, the dashboard, how every list and every record page works.
// Pictures: backend/scripts/guide/start.py
import type { GuideSection } from "../types";

export const CHAPTERS: GuideSection[] = [
  {
    id: "start-login",
    part: "Boshlash",
    pics: "start",
    title: "Tizimga kirish va menyu",
    who: "Hamma uchun",
    intro:
      "Rombo ERP brauzerda ishlaydi. Har bir xodimning o'z logini bor; menyuda faqat unga ruxsat berilgan sahifalar ko'rinadi. Bu bobda — kirish, chap menyu, yuqori panel va Bosh sahifa.",
    to: "/",
    blocks: [
      {
        h: "Tizimga kirish",
        shot: {
          img: "login",
          caption: "Kirish sahifasi",
          marks: [
            "Login — administrator bergan foydalanuvchi nomi",
            "Parol",
            "Ko'z belgisi — yozilgan parolni ko'rsatish yoki yashirish",
            "«Kirish»",
          ],
        },
        points: [
          "Login yoki parol xato bo'lsa — «Login yoki parol noto'g'ri» chiqadi. Qaysi biri xatoligi aytilmaydi.",
          "«Caps Lock yoqilgan» yozuvi chiqsa — katta harflar yoqilgan, parol xato yoziladi.",
          "Parolingiz o'zgartirilsa yoki hisobingiz bloklansa, tizim hamma qurilmada o'zi chiqarib yuboradi — yangi parol bilan qayta kiring.",
        ],
      },
      {
        h: "Chap menyu",
        text: "Sahifalar guruhlarga bo'lingan: Savdo, CRM, Servis, Ta'minot, Ishlab chiqarish, Ombor, Moliya, Buxgalteriya, Xodimlar. Sizga ruxsat berilmagan sahifa va guruh menyuda umuman ko'rinmaydi.",
        shot: {
          img: "menu",
          caption: "Chap menyu (Mijozlar sahifasi ochiq)",
          marks: [
            "Bosh sahifa — asosiy ko'rsatkichlar",
            "Ochiq guruh: bosilsa yopiladi. Bir vaqtda faqat bitta guruh ochiq turadi",
            "Hozirgi sahifa — ko'k fonda. Uning guruhi o'zi ochiladi",
            "Yopiq guruh: bosing — ichidagi sahifalar chiqadi, oldingi guruh yopiladi",
            "Sozlamalar — foydalanuvchilar, rollar, ma'lumotnomalar, narxlar, kompaniya va boshqalar bitta sahifada kartochka bo'lib turadi",
            "Qo'llanma — shu yo'riqnoma",
            "Mavzu: kunduzgi, tizimdagidek yoki tungi",
          ],
        },
        points: [
          "Bitta sahifali guruh (masalan, Xodimlar) guruh emas, to'g'ridan-to'g'ri sahifa bo'lib turadi.",
          "Yonida «tez orada» yozuvi bor sahifa hali tayyor emas — u bosilmaydi.",
          "Mavzu tanlovi shu brauzerda eslab qolinadi. «Tizim» — kompyuteringiz qaysi rejimda bo'lsa, shunisi.",
        ],
      },
      {
        h: "Yuqori panel",
        shot: {
          img: "topbar",
          caption: "Yuqori o'ng burchak, foydalanuvchi menyusi ochiq",
          marks: [
            "«Yangi loyiha» — istalgan sahifadan yangi buyurtma ochish (Loyiha yaratish ruxsati borlarga)",
            "Sizning ismingiz va rolingiz — bosilsa menyu ochiladi",
            "«Mening hisobim» — foydalanuvchi kartangiz",
            "«Chiqish» — shu brauzerda tizimdan chiqish",
          ],
        },
        tip: "Boshqalar ham foydalanadigan kompyuterda ishni tugatgach, albatta «Chiqish» ni bosing.",
      },
      {
        h: "Bosh sahifa",
        text: "Kirgandan keyin Bosh sahifa ochiladi. Unda sizga ochiq har bir bo'lim (Savdo, CRM, Ta'minot, Moliya, Buxgalteriya, Ombor, Xodimlar) uchun asosiy raqamlar va oxirgi 12 oy grafigi bor.",
        shot: {
          img: "dashboard",
          caption: "Bosh sahifa",
          marks: [
            "Bo'limlar: «Hammasi» yoki bittasini tanlang — tanlov eslab qolinadi",
            "Bo'lim kartasi: nomi, ko'rsatkichlari, grafik va ro'yxatlar",
            "Ko'rsatkich: raqamni bosing — shu raqamning ro'yxati ochiladi (masalan, jarayondagi loyihalar)",
            "«Ochish» — shu bo'limning asosiy sahifasiga o'tish",
          ],
        },
        points: [
          "Qizil raqam — e'tibor kerak (masalan, muddati o'tgan loyihalar).",
          "Pastda (Hammasi yoki Savdo tanlanganda) — loyihalar bosqichlari bo'yicha soni, «Muddati o'tgan» va «Jarayonda — muddat bo'yicha» ro'yxatlari.",
          "Pul raqamlari so'mda, buxgalteriya yozuvlari va hujjatlardan olinadi.",
        ],
      },
    ],
    faq: [
      ["Menyuda kerakli sahifa yo'q.", "Sizning rolingizda bu sahifani ko'rish ruxsati yo'q. Administratorga murojaat qiling (Sozlamalar → Rollar va ruxsatlar)."],
      ["Parolimni unutdim.", "Parolni administrator yangilaydi: Sozlamalar → Foydalanuvchilar. Eski parol bilan ochilgan hamma oynalar yopiladi."],
      ["Bosh sahifa bo'sh.", "Bosh sahifadagi bo'limlar ruxsatlarga qarab chiqadi. Hech bir bo'limga ruxsat bo'lmasa, raqamlar ko'rinmaydi."],
    ],
  },
  {
    id: "start-lists",
    part: "Boshlash",
    pics: "start",
    title: "Ro'yxatlar bilan ishlash",
    who: "Hamma uchun",
    intro:
      "Mijozlar, loyihalar, xaridlar, ombor harakatlari — hammasi bir xil ro'yxatda turadi: tepada qidiruv va filtrlar, ustun bo'yicha tartiblash, pastda sahifalar, chapda belgilash katakchalari va Excel. Bir marta o'rgansangiz — hamma joyda ishlaydi.",
    blocks: [
      {
        h: "Qidiruv, filtr, tartib",
        shot: {
          img: "list",
          caption: "Ro'yxat (misol: Savdo → Mijozlar)",
          marks: [
            "Qidiruv — yozishni to'xtatishingiz bilan natija chiqadi. Klaviaturada «/» bossangiz, kursor shu yerga o'tadi",
            "Tez filtr — bitta tugma bilan turini tanlash",
            "Ochiladigan filtrlar — hudud, menejer, holat",
            "Ustun nomini bosing — shu ustun bo'yicha tartiblanadi: bir marta ↑, yana bir marta ↓, uchinchi marta — tartib bekor",
            "Belgilash katakchasi: sarlavhadagisi — shu sahifadagi hammasini belgilaydi",
            "Excel — yuklab olish va Excel'dan kiritish",
            "Sahifalar: «1–25 / 128» — nechtasi ko'rsatilgani va jami; ‹ › — oldingi va keyingi sahifa",
          ],
        },
        points: [
          "Filtr yoki qidiruv o'zgarsa, ro'yxat birinchi sahifadan boshlanadi.",
          "Filtrlar sahifa manzilida saqlanadi: kartadan «orqaga» qaytsangiz, filtr joyida turadi. Manzilni nusxa olib hamkasbga yuborsangiz, u ham xuddi shu ro'yxatni ko'radi.",
          "Hech narsa topilmasa — «… bo'yicha hech narsa topilmadi» yoziladi. Filtrlarni tekshiring.",
          "Qatorni bosing — yozuv kartasi ochiladi.",
        ],
      },
      {
        h: "Bir nechta yozuv bilan birdan ishlash",
        text: "Chapdagi katakchalar bilan yozuvlarni belgilang — jadval tepasida guruh amallari paneli chiqadi.",
        shot: {
          img: "bulk",
          caption: "Ikkita mijoz belgilangan",
          marks: [
            "Belgilangan qator — och ko'k fonda",
            "Nechta yozuv tanlangani",
            "Guruh amallari — har ro'yxatda o'ziniki (bu yerda: «Nofaol qilish», «Faol qilish», «Arxivlash»). Qizil — xavfli amal",
            "«Tozalash» — belgilarni olib tashlash",
          ],
        },
        points: [
          "Belgilar boshqa sahifaga o'tganda saqlanadi, filtr o'zgarsa — tozalanadi.",
          "Amal tanlangach, tasdiqlash oynasi chiqadi. Har bir yozuv alohida bajariladi — xuddi o'z kartasidagi tugma kabi va xuddi o'sha ruxsat bilan.",
          "Ba'zilari bajarilmasa (masalan, omborda yetarli emas), ular sababi bilan ro'yxatda ko'rsatiladi va belgilangan holda qoladi — tuzatib, qayta urinish mumkin.",
          "Bitta guruh amalida ko'pi bilan 500 ta yozuv.",
        ],
      },
      {
        h: "Excel: yuklab olish",
        shot: {
          img: "excel",
          caption: "Excel menyusi",
          marks: [
            "Ro'yxatni yuklab olish — hozirgi filtr va qidiruvdagi hamma yozuvlar (ko'pi bilan 10 000 qator)",
            "Tanlanganlarni yuklab olish — faqat belgilangan yozuvlar (biror qator belgilanganda chiqadi)",
            "Excel'dan import — fayldan yangi yozuvlar qo'shish",
            "Import shabloni — to'g'ri ustunlari bor bo'sh Excel fayl",
          ],
        },
        tip: "Import bandlari faqat shu ro'yxatda yaratish ruxsati borlarga chiqadi. Hamma ro'yxatda ham import yo'q.",
      },
      {
        h: "Excel'dan import",
        shot: {
          img: "import",
          caption: "Excel'dan import oynasi",
          marks: [
            "Fayldagi ustunlar: birinchi qatorda aynan shu nomlar bo'lishi kerak. * — majburiy ustun",
            "Faylni tanlang (.xlsx)",
            "Shablon — to'g'ri ustunli faylni yuklab olish",
            "«Tekshirish» — fayl tekshiriladi, hech narsa saqlanmaydi",
          ],
        },
        steps: [
          "«Shablon» ni yuklab oling va uni to'ldiring (bir qator — bitta yozuv).",
          "«Faylni tanlang» — to'ldirilgan faylni tanlang.",
          "«Tekshirish» ni bosing: nechta qator qo'shilishi va xatosi bor qatorlar (qator raqami va sababi) ko'rsatiladi.",
          "Hammasi to'g'ri bo'lsa — «Import qilish (N ta)» ni bosing.",
        ],
        points: [
          "Xatosi bor qator o'tkazib yuboriladi, qolganlari baribir qo'shiladi.",
          "Bitta faylda ko'pi bilan 2 000 qator.",
        ],
      },
    ],
    faq: [
      ["Excel fayl yuklanmayapti.", "Ro'yxatda 10 000 dan ortiq yozuv bo'lsa, filtr bilan qisqartiring. Faqat ko'rish ruxsati bo'lsa ham yuklab olish mumkin."],
      ["Guruh amallari paneli bo'sh.", "Bu ro'yxatda guruh amallari yo'q — faqat tanlanganlarni Excel'ga yuklab olish mumkin."],
    ],
  },
  {
    id: "start-record",
    part: "Boshlash",
    pics: "start",
    title: "Yozuv sahifasi va tarix",
    who: "Hamma uchun",
    intro:
      "Ro'yxatdagi qatorni bossangiz, yozuv kartasi ochiladi (mijoz, loyiha, xodim, hujjat). Hamma kartalar bir xil tuzilgan: tepada yo'l va oldingi/keyingi tugmalari, keyin amallar paneli, o'rtada ma'lumotlar, o'ngda — Tarix.",
    blocks: [
      {
        h: "Karta tuzilishi",
        shot: {
          img: "record",
          caption: "Yozuv kartasi (misol: mijoz)",
          marks: [
            "Yo'l: qaysi sahifalar orqali kelganingiz. Istalganini bosing — o'sha sahifaga qaytasiz",
            "«10 / 11 ‹ ›» — kelgan ro'yxatingizdagi oldingi va keyingi yozuvga o'tish, ro'yxatga qaytmasdan",
            "Amallar paneli: tugmalar (Saqlash, O'chirish, bosqich tugmalari…) chapda, holat — o'ngda",
            "Yozuv nomi; tepasida — turi va kodi",
            "Tezkor tugmalar: raqam — bog'liq yozuvlar soni. Bosilsa, ularning ro'yxati ochiladi",
            "Tarix — kim, qachon, nimani o'zgartirgani va izohlar",
          ],
        },
        points: [
          "Ruxsatingiz faqat ko'rishga bo'lsa, maydonlar kulrang bo'ladi va o'zgartirib bo'lmaydi.",
          "«O'chirish» darhol o'chirmaydi: avval tasdiqlash so'raladi, yozuv arxivga o'tadi.",
        ],
      },
      {
        h: "O'zgartirish va saqlash",
        text: "Maydonni o'zgartirishingiz bilan amallar panelida «Saqlash» va «Bekor qilish» paydo bo'ladi.",
        shot: {
          img: "dirty",
          caption: "Bitta maydon o'zgartirildi",
          marks: [
            "«Saqlash» — o'zgarishlarni yozish",
            "«Bekor qilish» — o'zgarishlarni tashlab, avvalgi qiymatlarga qaytish",
            "O'zgartirilgan maydon",
          ],
        },
        points: [
          "Saqlamasdan boshqa sahifaga o'tsangiz, o'zgarishlar yo'qoladi.",
          "Xato bo'lsa (masalan, majburiy maydon bo'sh), saqlanmaydi — maydon ostida qizil yozuv chiqadi. * belgili maydonlar majburiy.",
        ],
      },
      {
        h: "Tarix: izohlar va o'zgarishlar",
        shot: {
          img: "history",
          caption: "Kartaning o'ng tomoni — Tarix",
          marks: [
            "Izoh qoldiring — hamkasblar uchun yozuv. Yuborish: o'ngdagi tugma yoki Ctrl + Enter",
            "«Izohlar» — faqat odamlar yozgan izohlar",
            "«O'zgarishlar» — faqat tizim yozuvlari: yaratilgani, maydon o'zgarishlari, qo'ng'iroqlar va hokazo",
            "O'zgarish: kim va qachon; eski qiymat ustidan chizilgan → yangi qiymat",
            "Tarixni yashirish — o'ng pastda «Tarix» tugmasi qoladi, bosilsa qaytadi",
          ],
        },
        points: [
          "Tarixni o'zgartirib yoki o'chirib bo'lmaydi — bu yozuvning to'liq hikoyasi.",
          "Yangi yozuvlar har 30 soniyada o'zi yangilanadi.",
          "Tarix yashirilgan yoki ochiqligi shu brauzerda eslab qolinadi.",
        ],
      },
      {
        h: "Yo'l (orqaga qaytish)",
        text: "Bir hujjatdan ikkinchisiga havolalar orqali o'tsangiz (masalan, Loyiha → Xarid buyurtmasi → Pul so'rovi → Chiqim orderi), tepada yo'l yig'iladi: «XB-00001 › PS-00001 › RKO-00001». Istalgan bo'g'inni bosib, o'sha hujjatga qaytasiz.",
        points: [
          "Chap menyudan, Bosh sahifadan yoki «Yangi loyiha» dan o'tsangiz, yo'l yangidan boshlanadi.",
          "Oldin ochilgan sahifaga qaytsangiz, yo'l o'sha joygacha qisqaradi.",
          "‹ › tugmalari yoki saqlash yo'lga yangi bo'g'in qo'shmaydi — oxirgisini almashtiradi.",
          "Ro'yxat bo'g'ini filtrlarini eslab qoladi.",
        ],
      },
    ],
    faq: [
      ["‹ › tugmalari ko'rinmayapti.", "Ular yozuvni ro'yxatdan ochganda chiqadi va o'sha ro'yxatning ochiq sahifasidagi yozuvlar bo'yicha yuradi. Havola orqali yoki manzil yozib ochilganda ko'rinmaydi."],
      ["Izohni o'chirsa bo'ladimi?", "Yo'q. Izoh tarixning bir qismi — xato bo'lsa, ostidan to'g'risini yozing."],
    ],
  },
];
