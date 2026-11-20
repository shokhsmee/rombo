// Qo'llanma → CRM: Voronka (lidlar), lid kartasi, analitika va sozlamalar, mijozlar xaritasi. Pictures: backend/scripts/guide/crm.py
import type { GuideSection } from "../types";

export const CHAPTERS: GuideSection[] = [
  {
    id: "crm-board",
    part: "CRM",
    pics: "crm",
    pages: ["crm"],
    title: "Voronka: lidlar doskasi",
    who: "Sotuv menejeri uchun",
    intro:
      "Lid — hali Loyiha bo'lmagan murojaat: kimdir qo'ng'iroq qildi, saytdan yozdi yoki do'konga keldi. Voronka — lidlarning bosqichlar bo'yicha doskasi: Yangi → Bog'lanildi → O'lchov → Taklif → Shartnoma, oxirida «Yutildi» yoki «Rad etildi».",
    to: "/crm",
    blocks: [
      {
        h: "Doska",
        text: "Chap menyuda CRM → Voronka. Har bir ustun — bitta bosqich, har bir kartochka — bitta lid.",
        shot: {
          img: "board",
          caption: "CRM → Voronka",
          marks: [
            "Bosqich ustuni: nomi, lidlar soni, byudjetlar jami va bosqich izohi",
            "Lid kartochkasi: nima kerak, mijoz, telefon, byudjet, menejer, manba va keyingi vazifa. Bosilsa — lid kartasi ochiladi",
            "«+» — shu bosqichga tez lid qo'shish",
            "Qidiruv: nom, telefon, teg, kod bo'yicha",
            "Ko'rinish: Kanban (doska) yoki Ro'yxat",
            "Analitika — voronka va qo'ng'iroqlar hisoboti",
            "CRM sozlamalari — bosqichlar, maydonlar, taqsimlash",
            "«Yangi lid» — to'liq forma bilan lid ochish",
          ],
        },
        points: [
          "Lidni boshqa bosqichga o'tkazish uchun kartochkani sichqoncha bilan sudrab, kerakli ustunga tashlang.",
          "«Rad etildi» ustuniga tashlansa, sabab so'raladi — sababsiz rad etib bo'lmaydi.",
          "Qizil vaqt — vazifa muddati o'tgan. «Vazifa yo'q» — keyingi qadam rejalashtirilmagan.",
          "Yutilgan va rad etilgan lidlar 30 kundan keyin doskadan yashiriladi. Ularni «Yutilgan» / «Rad etilgan» tugmalari bilan ko'rasiz.",
        ],
      },
      {
        h: "Kartochkadagi tez tugmalar",
        text: "Sichqonchani kartochka ustiga olib borsangiz, ikki tugma chiqadi.",
        shot: {
          img: "card-hover",
          caption: "Kartochka ustida",
          marks: [
            "Lid kartochkasi",
            "Tez tahrirlash — nom, bosqich, menejer, byudjet, manba, teglar va yangi vazifani bitta oynada o'zgartirish",
            "Qo'ng'iroq qilish — mijoz raqamiga qo'ng'iroq (telefoniya ulangan bo'lsa)",
          ],
        },
      },
      {
        h: "Tez lid qo'shish",
        text: "Telefonda gaplashayotganda to'liq formani ochish shart emas: ustundagi «+» ni bosing.",
        shot: {
          img: "quick-add",
          caption: "Ustundagi «+»",
          marks: [
            "Nima kerak — masalan, «3 xona derazalari»",
            "Mijoz ismi",
            "Telefon — shu raqamda ochiq lid bo'lsa, ogohlantirish chiqadi",
            "Byudjet (taxminiy summa)",
            "«Qo'shish» — lid shu bosqichda paydo bo'ladi",
          ],
        },
        tip: "Nom, ism yoki telefondan bittasi yetarli. Raqam bazadagi mijozga to'g'ri kelsa, lid o'sha mijozga o'zi bog'lanadi.",
      },
      {
        h: "Tez ko'rinishlar va filtr",
        shot: {
          img: "filters",
          caption: "Filtr paneli ochilgan",
          marks: [
            "Tez ko'rinishlar: Meniki, Bugungi vazifalar, Muddati o'tgan, Vazifasiz, 3 kundan beri jim, O'tkazilgan qo'ng'iroq…",
            "«Filtr» — batafsil filtr panelini ochish (yonidagi raqam — nechta shart tanlangan)",
            "Holat, bosqich, menejer, vazifa, kelgan sana, byudjet, manba, teglar bo'yicha tanlang",
            "Filtrni nom bilan saqlash — keyin bir bosishda qayta yoqiladi",
            "«Ko'rsatish» — panelni yopish (yonida mos lidlar soni)",
          ],
        },
        points: [
          "Saqlangan filtrlar faqat shu brauzerda turadi.",
          "«Tozalash» — barcha filtrlarni olib tashlash.",
        ],
      },
      {
        h: "Ro'yxat va bir nechta lid bilan ishlash",
        text: "Ko'p lidni birdan o'zgartirish uchun «Ro'yxat» ko'rinishiga o'ting.",
        shot: {
          img: "list",
          caption: "Ro'yxat ko'rinishi, bitta lid tanlangan",
          marks: [
            "Tanlanganlar uchun amallar: bosqichga o'tkazish, menejerga berish, teg qo'shish, rad etish, o'chirish",
            "Belgilash katakchasi — lidni tanlash (sarlavhadagisi — hammasini)",
            "Bosqichni shu yerning o'zida almashtirish mumkin",
            "Jami: lidlar soni va byudjet summasi",
          ],
        },
        tip: "Ustun sarlavhasini bossangiz, ro'yxat shu ustun bo'yicha tartiblanadi.",
      },
    ],
    faq: [
      ["Kartochkani sudrab bo'lmayapti.", "Sizda CRM'ni tahrirlash ruxsati yo'q. Ruxsatlar: Sozlamalar → Rollar va ruxsatlar."],
      ["Yutilgan lidim doskadan yo'qoldi.", "30 kundan oshgan yutilgan va rad etilgan lidlar yashiriladi. «Yutilgan» tez ko'rinishini bosing."],
    ],
  },
  {
    id: "crm-lead",
    part: "CRM",
    pics: "crm",
    pages: ["crm"],
    title: "Lid kartasi: vazifa, rad etish, Loyiha ochish",
    who: "Sotuv menejeri uchun",
    intro:
      "Lid kartasida mijoz bilan bog'liq hamma narsa: ma'lumotlar, keyingi vazifa, qo'ng'iroqlar va tarix. Mijoz rozi bo'lsa — shu yerdan bitta tugma bilan Loyiha ochiladi.",
    to: "/crm",
    blocks: [
      {
        h: "Lid kartasi",
        shot: {
          img: "lead",
          caption: "Lid kartasi",
          marks: [
            "«Loyiha ochish» — mijoz rozi bo'ldi: Loyiha va mijoz yaratiladi, lid «Yutildi» bo'ladi",
            "Keyingi bosqichga o'tkazish (bu yerda «O'lchov →»)",
            "«Bosqich» — istalgan bosqichni tanlash, jumladan orqaga qaytarish",
            "«Rad etish» — mijoz voz kechdi (sabab bilan)",
            "Bosqichlar chizig'i: hozirgi bosqich ko'k",
            "Menejer — lid kimning qo'lida",
            "Telefon — shu raqam bo'yicha qo'ng'iroqlar va mijoz topiladi",
          ],
        },
        points: [
          "Sarlavha ustida: lid kodi (LD-…), bosqich va shu bosqichda necha kun turgani.",
          "«Mijoz kartasi» bo'sh bo'lsa, telefon raqami bo'yicha topiladi yoki Loyiha ochilganda yaratiladi.",
          "Pastda — «Qo'ng'iroqlar»: shu lidning barcha qo'ng'iroqlari. O'ngda — «Tarix»: kim, qachon nimani o'zgartirgani.",
          "Maydon o'zgarsa, yuqorida «Saqlash» chiqadi. Saqlanmagan o'zgarish bor paytda bosqich tugmalari yashirinadi.",
        ],
      },
      {
        h: "Vazifalar — keyingi qadam",
        text: "Har bir ochiq lidda keyingi qadam bo'lishi kerak: qayta qo'ng'iroq, o'lchov, uchrashuv. Vazifa yo'q bo'lsa, kartada sariq ogohlantirish turadi.",
        shot: {
          img: "tasks",
          caption: "Lid kartasi → Vazifalar",
          marks: [
            "Vazifa turi (turlar ro'yxati CRM sozlamalarida)",
            "Nima qilish kerak — qisqa izoh",
            "Muddat — sana va soat",
            "Tez muddat: 1 soatdan keyin, Bugun 18:00, Ertaga 10:00, Bir haftadan keyin",
            "Bajarildi — katakchani belgilang, tarixga yoziladi",
          ],
        },
        steps: [
          "Turini tanlang va nima qilishni yozing.",
          "Muddatni qo'ying yoki tez muddat tugmasini bosing.",
          "Enter yoki «Qo'shish» ni bosing.",
        ],
        tip: "Muddati kelgan vazifa haqida mas'ul xodimga bildirishnoma keladi. Muddati o'tgan vazifa qizil bo'ladi.",
      },
      {
        h: "Loyiha ochish",
        shot: {
          img: "convert",
          caption: "«Loyiha ochish» oynasi",
          marks: [
            "Nima bo'lishi yozilgan: qaysi mijoz olinadi yoki yaratiladi, summa va lid «Yutildi» bo'lishi",
            "Loyiha nomi — lid nomidan olinadi, o'zgartirsa bo'ladi",
            "«Loyiha ochish» — tasdiqlash",
          ],
        },
        points: [
          "Mijoz: lidga biriktirilgan mijoz; bo'lmasa — shu telefonli mijoz; u ham bo'lmasa — yangi mijoz yaratiladi.",
          "Loyiha «Qoralama» bosqichida ochiladi, summasi — lid byudjeti. Menejer, telefon, hudud, manzil va manba liddan ko'chadi.",
          "Lid kartasida Loyiha va Mijoz tugmalari paydo bo'ladi. Bitta liddan ikkinchi Loyiha ochib bo'lmaydi.",
          "Davomi — «Loyiha: yangi buyurtma» bobida.",
        ],
        tip: "«Loyiha ochish» tugmasi faqat Loyiha yaratish ruxsati borlarga chiqadi. Ruxsat bo'lmasa, uning o'rnida «Yutildi» tugmasi bo'ladi.",
      },
      {
        h: "Rad etish",
        shot: {
          img: "lost",
          caption: "«Rad etish» oynasi",
          marks: [
            "Tayyor sabablar — bittasini bosing",
            "Yoki o'z sababingizni yozing",
            "«Rad etish» — lid «Rad etildi» bosqichiga o'tadi",
          ],
        },
        points: [
          "Sabablar ro'yxati CRM sozlamalarida to'ldiriladi; analitikada qaysi sabab ko'p ekani ko'rinadi.",
          "Rad etilgan lidni «Qayta ochish» tugmasi bilan birinchi bosqichga qaytarish mumkin.",
        ],
      },
      {
        h: "Dubllar",
        text: "Sozlamalarda «Dubllarni aniqlash» yoqilgan bo'lsa, bir raqamda bir nechta ochiq lid paydo bo'lganda kartochkada «Dubl» belgisi chiqadi. Lid kartasining tepasida boshqa lidlar ro'yxati va «Shu yerga birlashtirish» tugmasi bo'ladi: vazifalar, qo'ng'iroqlar, tarix va teglar shu lidga o'tadi, ikkinchisi «Dubl» sababi bilan yopiladi.",
      },
    ],
    faq: [
      ["Lidni o'chirsam bo'ladimi?", "Ha, o'chirish ruxsati bo'lsa. Lekin Loyiha ochilgan lidni o'chirib bo'lmaydi."],
      ["Loyiha ochildi, lekin summa noto'g'ri.", "Summa lid byudjetidan olinadi. Loyiha kartasida yoki hisob-kitob qo'shib to'g'rilang."],
    ],
  },
  {
    id: "crm-setup",
    part: "CRM",
    pics: "crm",
    pages: ["crm"],
    title: "CRM analitikasi va sozlamalari",
    who: "Sotuv rahbari va administrator uchun",
    intro:
      "Analitika — davr bo'yicha voronka: nechta lid keldi, qanchasi yutildi, qayerda yo'qoldi, qaysi menejer qanday ishladi. Sozlamalarda bosqichlar, lid maydonlari, vazifa turlari va lidlarni taqsimlash belgilanadi.",
    to: "/crm/analytics",
    blocks: [
      {
        h: "Analitika",
        text: "Voronka sahifasining yuqorisidagi diagramma belgisini bosing.",
        shot: {
          img: "analytics",
          caption: "CRM → Analitika",
          marks: [
            "Bo'lim: Voronka yoki Qo'ng'iroqlar (telefoniya ulangan bo'lsa)",
            "Davr: bugun, 7 kun, 30 kun, shu oy, o'tgan oy, 90 kun",
            "Asosiy raqamlar: yangi, yutildi, rad etildi, konversiya, yutilgan summa, ochiq vazifalar",
            "Kunlar bo'yicha: yangi, yutilgan va rad etilgan lidlar",
            "Voronka: har bir bosqichga nechta lid yetdi, foizi va o'rtacha necha kun turdi",
          ],
        },
        points: [
          "Pastda: «Manbalar» (qayerdan kelgan), «Rad etish sabablari» va «Menejerlar» jadvali — javob tezligi, qo'ng'iroqlar, suhbat vaqti.",
          "«Barcha menejerlar» o'rniga bitta xodimni tanlab, faqat uning raqamlarini ko'rish mumkin.",
          "«Qo'ng'iroqlar» bo'limida: javob berish foizi, o'tkazilgan va qayta qo'ng'iroq qilinganlar, hafta kunlari × soatlar jadvali.",
        ],
      },
      {
        h: "Bosqichlar va rad etish sabablari",
        text: "Voronka sahifasidagi sozlamalar belgisi yoki /crm/settings.",
        shot: {
          img: "settings",
          caption: "CRM sozlamalari → Voronka",
          marks: [
            "Bo'limlar: Voronka, Lid maydonlari, Vazifalar va qo'shimchalar, Taqsimlash, Lid manbalari",
            "Yangi voronka qo'shish (masalan, dilerlar uchun alohida)",
            "Ish bosqichlari: nomi, ustun ostidagi izoh, rangi; strelkalar — tartib, savat — o'chirish",
            "Yangi bosqich — nomini yozib Enter",
            "Tizim bosqichlari — «Yutildi» va «Rad etildi», ular o'chirilmaydi",
            "Rad etish sabablari — lidni rad etishda tanlanadi",
          ],
        },
        points: [
          "O'zgarish maydondan chiqqanda darhol saqlanadi.",
          "Ichida lid bor bosqichni o'chirib bo'lmaydi — avval lidlarni boshqa bosqichga o'tkazing.",
        ],
      },
      {
        h: "Lid maydonlari, vazifa turlari, qo'shimchalar",
        points: [
          "«Lid maydonlari» — lid kartasiga o'z maydonlaringiz: xonalar soni, profil rangi, o'lchov sanasi… Turi (matn, son, sana, ro'yxat, telefon, havola, ha/yo'q) va bo'limi (Bitim, Mijoz, Qo'shimcha) yaratilgandan keyin o'zgarmaydi.",
          "«Mijoz» bo'limidagi maydon mijozga tegishli: shu mijozning barcha lidlarida bir xil ko'rinadi.",
          "Keraksiz maydonni o'chirishdan ko'ra yashiring (ko'z belgisi) — saqlangan qiymatlar yo'qolmaydi.",
          "«Vazifalar va qo'shimchalar» — vazifa turlari (birinchisi odatiy tur), «Dubllarni aniqlash» va «Mas'ulni avtomatik taqsimlash» yoqgichlari.",
          "Doskadagi «Kartochka ko'rinishi» tugmasi — kartochkada qaysi ma'lumotlar ko'rinishini hamma uchun tanlash.",
        ],
      },
      {
        h: "Lidlarni taqsimlash",
        shot: {
          img: "settings-distribution",
          caption: "CRM sozlamalari → Taqsimlash",
          marks: [
            "Navbat bilan — har yangi lid navbatdagi xodimga",
            "Eng kam yuklanganga — ochiq lidlari eng kam xodimga",
            "Navbatdagi xodimlar — taqsimlashda qatnashadiganlar",
          ],
        },
        points: [
          "Avval «Vazifalar va qo'shimchalar»da «Mas'ulni avtomatik taqsimlash» ni yoqing.",
          "Menejersiz kelgan lidlar (tez qo'shishda «Taqsimlash» belgilansa, qo'ng'iroq, sayt formasi, Telegram) navbatdagi xodimga beriladi va unga bildirishnoma keladi.",
        ],
      },
      {
        h: "Lid manbalari",
        text: "«Lid manbalari» bo'limida sayt va reklama formalari, Yuboraman va amoCRM ulanadi. Har bir ulanishning o'z webhook manzili bor — uni faqat shu xizmatga bering. Formadan kelgan murojaat avtomatik lid bo'ladi; shu raqamda ochiq lid bo'lsa, o'shanga yoziladi.",
      },
    ],
  },
  {
    id: "crm-map",
    part: "CRM",
    pics: "crm",
    pages: ["client_map"],
    title: "Mijozlar xaritasi",
    who: "Sotuv menejeri va o'lchovchi uchun",
    intro:
      "Mijozlar xaritada: kim qayerda turadi — tashrif, o'lchov va o'rnatishni yo'l bo'yicha rejalash uchun. Xaritada faqat lokatsiyasi belgilangan mijozlar chiqadi.",
    to: "/crm/map",
    blocks: [
      {
        h: "Xarita",
        shot: {
          img: "map",
          caption: "CRM → Mijozlar xaritasi",
          marks: [
            "Qidiruv: nom, telefon, hudud. Yonida — mijoz turi, segment va menejer bo'yicha filtr",
            "Nuqta rangi: mijoz turi yoki segmenti bo'yicha",
            "Ro'yxat: nechta mijoz xaritada, nechtasida lokatsiya yo'q. Qatorni bossangiz, xarita o'sha mijozga boradi",
            "Xarita: nuqtani bossangiz, ro'yxatda o'sha mijoz belgilanadi",
            "«Hammasi» — barcha nuqtalarni ko'rsatish; «Samarqand» — bosh shaharga qaytish",
            "Ranglar izohi",
          ],
        },
        points: [
          "«Faqat xaritada ko'rinayotganlar» — ro'yxatda faqat ekrandagi hududdagi mijozlar qoladi.",
          "Qatordagi kichik raqam — mijozning faol loyihalari soni.",
          "Lokatsiya mijoz kartasida belgilanadi («Mijozlar» bobiga qarang).",
        ],
      },
    ],
  },
];
