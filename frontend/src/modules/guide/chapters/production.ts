// Qo'llanma → Ishlab chiqarish: Tarkiblar (BOM), the Loyiha's materials, MRP and the three factory steps.
// Pictures: backend/scripts/guide/production.py
import type { GuideSection } from "../types";

export const CHAPTERS: GuideSection[] = [
  {
    id: "bom",
    part: "Ishlab chiqarish",
    pics: "production",
    pages: ["bom"],
    title: "Tarkiblar (BOM)",
    who: "Texnolog va ishlab chiqarish boshlig'i uchun",
    intro:
      "Tarkib (BOM) — bitta tayyor mahsulot nimadan yasalishi: qaysi material, qancha (bir donaga yoki 1 m² ga) va qancha chiqindi. Bir marta yozib qo'yiladi — keyin har bir Loyihaga kerakli materiallar, xarid va sexga berish shundan o'zi hisoblanadi.",
    to: "/mrp/boms",
    blocks: [
      {
        h: "Tarkiblar ro'yxati",
        text: "Chap menyuda Ishlab chiqarish → Tarkiblar (BOM).",
        shot: {
          img: "bom-list",
          caption: "Ishlab chiqarish → Tarkiblar (BOM)",
          marks: [
            "«Tarkib» — yangi tarkib",
            "Faol tarkiblar yoki eski versiyalar",
            "«Qatorlar Excel» — barcha tarkib qatorlarini Excel'ga yuklab olish yoki Excel'dan kiritish",
            "Qatorni bosing — tarkib ochiladi",
          ],
        },
        tip: "«Material bo'yicha» filtri — qaysi mahsulotlarda shu material ishlatilganini topadi (masalan, profil narxi o'zgarganda).",
      },
      {
        h: "Tarkibni to'ldirish",
        shot: {
          img: "bom-form",
          caption: "Tarkib kartasi",
          marks: [
            "Mahsulot — tayyor mahsulot (deraza, eshik…). Bitta mahsulotning bitta faol tarkibi bo'ladi",
            "Rejalangan tannarx: bir donaga va 1 m² ga — materiallarning o'rtacha narxidan",
            "Asos: «1 m² ga» — buyumning umumiy maydoniga ko'paytiriladi; «bir donaga» — buyum soniga",
            "Chiqindi % — kesishda ketadigan qism; miqdorga qo'shiladi",
            "Eslatma: yarim tayyor materialning (masalan, steklopaket) o'z tarkibi bo'lsa, u ham ochib hisoblanadi",
          ],
        },
        steps: [
          "«Tarkib» ni bosing va tayyor mahsulotni tanlang.",
          "Har bir material uchun qator: materialni tanlang, miqdor, asos (1 m² ga yoki bir donaga) va chiqindi foizi.",
          "Masalan: profil 3,2 m «1 m² ga», chiqindi 5% · oyna 0,85 m² «1 m² ga» · ruchka 1 dona «bir donaga».",
          "«Saqlash» ni bosing.",
        ],
        tip: "Tarkib tasdiqlangan Loyihada ishlatilgan bo'lsa (sariq ogohlantirish chiqadi), qatorlarni o'zgartirsangiz yangi versiya ochiladi. Eski versiya «Eski versiya» bo'lib qoladi — tasdiqlangan buyurtmalar o'zgarmaydi.",
      },
      {
        h: "Sinab ko'rish",
        text: "Tarkib kartasining pastida — tekshirish uchun hisoblagich. Loyiha xuddi shu hisobni ishlatadi.",
        shot: {
          img: "bom-try",
          caption: "Sinab ko'rish",
          marks: [
            "Buyum soni (dona) va umumiy maydoni (m²)",
            "Shuncha buyum uchun kerakli materiallar — chiqindi bilan",
          ],
        },
      },
    ],
    faq: [
      ["Tarkibni o'chirib bo'lmayapti.", "Tarkib Loyihada ishlatilgan. Uni o'chirmang — yangi versiya oching yoki «Faol» belgisini olib tashlang."],
      ["«Tarkib o'zini o'z ichiga oladi» xatosi.", "Material sifatida shu mahsulotning o'zi (yoki uni ichiga olgan yarim tayyor mahsulot) tanlangan. Qatorni tekshiring."],
    ],
  },
  {
    id: "project-materials",
    part: "Ishlab chiqarish",
    pics: "production",
    pages: ["bom", "mrp"],
    title: "Loyiha materiallari",
    who: "Texnolog, ta'minotchi va omborchi uchun",
    intro:
      "Loyiha kartasidagi «Materiallar (tarkib bo'yicha)» bloki shu buyurtmaga qancha profil, oyna va furnitura kerakligini ko'rsatadi. Buning uchun har bir buyumga tarkibi bor mahsulot tanlanadi.",
    to: "/projects",
    blocks: [
      {
        h: "Buyumga mahsulot tanlash",
        text: "Loyiha kartasini oching va pastga — «Materiallar (tarkib bo'yicha)» blokiga tushing.",
        shot: {
          img: "materials",
          caption: "Loyiha → Materiallar (tarkib bo'yicha)",
          marks: [
            "Buyum: turi, maydoni va soni. O'ng tomonda — «Qaysi mahsulot?»: tayyor mahsulotni tanlang",
            "«tarkibi bor» — hisoblanadi; «tarkibi yo'q — yaratish» — bosing va tarkib yozing",
            "Materiallar: kerak, chiqim qilingan (sexga berilgan), qolgan, so'ralgan, omborda va tannarx. Qizil «Omborda» — yetmaydi",
            "«BOM'dan hisob-kitobga» — materiallar sonini Loyiha hisob-kitobiga yozadi (narxlar o'zgarmaydi)",
            "«Xarid so'rovi» — hali so'ralmagan qolgan materiallardan xarid so'rovi ochadi",
            "«Materiallarni berish» — sexga berish oynasi (pastda, «Sexda» bo'limida)",
            "«Qayd etish» — ro'yxatni hozirgi tarkiblar bo'yicha qayd qilish",
          ],
        },
        points: [
          "Qoralama Loyihada materiallar buyumlarga ergashadi: buyum soni 4 dan 6 ga o'zgarsa, har bir material ham ko'payadi.",
          "Pastda — rejalangan tannarx va sexga berilgan materiallar summasi (tugallanmagan ishlab chiqarish).",
        ],
      },
      {
        h: "Tasdiqlangandan keyin: qayd etilgan ro'yxat",
        text: "Loyiha tasdiqlanganda materiallar ro'yxati qayd etiladi. Shundan keyin tarkib o'zgarsa ham, bu buyurtmaning materiallari o'zgarmaydi.",
        shot: {
          img: "materials-frozen",
          caption: "Tasdiqlangan Loyiha materiallari",
          marks: [
            "Belgi: ro'yxat qayd etilgan",
            "«Qayta hisoblash» — joriy tarkiblardan qayta hisoblaydi. Sexga birorta material berilgandan keyin bu tugma yo'qoladi",
          ],
        },
      },
      {
        h: "Chizma bo'lsa",
        text: "Loyihada Konstruktor chizmalari bo'lsa, materiallar tarkibdan emas, chizmadan aniq olinadi: har bir deraza uchun profil, oyna va furnitura qancha ketishi chizmada hisoblangan. MRP ham shu raqamlarni ishlatadi. Chizish — «Chizmalar» bobida.",
      },
    ],
    faq: [
      ["Materiallar bo'sh.", "Buyumlarga mahsulot tanlanmagan yoki tanlangan mahsulotning tarkibi yo'q. «tarkibi yo'q — yaratish» havolasini bosing."],
      ["«Qaysi mahsulot?» tanlab bo'lmayapti.", "Materiallar ro'yxati qayd etilgan (Loyiha tasdiqlangan) yoki sizda Loyihani o'zgartirish ruxsati yo'q."],
    ],
  },
  {
    id: "mrp",
    part: "Ishlab chiqarish",
    pics: "production",
    pages: ["mrp"],
    title: "MRP: nima sotib olish kerak",
    who: "Ta'minotchi va ishlab chiqarish boshlig'i uchun",
    intro:
      "MRP — barcha ochiq Loyihalar bo'yicha material rejasi. Har bir material uchun: qancha kerak, omborda qancha bor, qanchasi yo'lda (yuborilgan buyurtmalarda), qanchasi so'ralgan — va yetmayotgani (kamomad).",
    to: "/mrp",
    blocks: [
      {
        h: "Material rejasi",
        text: "Chap menyuda Ishlab chiqarish → MRP. Hisobga Tasdiqlangan, Xaridda, Ishlab chiqarishda va Tayyor bosqichidagi Loyihalarning qolgan materiallari kiradi.",
        shot: {
          img: "mrp",
          caption: "Ishlab chiqarish → MRP",
          marks: [
            "Kamomad — nechta materialda yetishmovchilik bor; bosilsa, faqat ular qoladi",
            "«Faqat kamomad» — yetarli materiallarni yashirish. Yonida: turkum, Loyiha va muddat filtri",
            "Omborda — barcha faol omborlardagi qoldiq",
            "Yo'lda — yetkazib beruvchiga yuborilgan, hali kelmagan miqdor",
            "Sotib olish — kamomad xarid birligiga yaxlitlangan: masalan, 14 m profil = 3 dona 6,5 metrlik tayoq",
            "«Xarid so'rovi yaratish» — belgilangan kamomadlardan xarid so'rovlari",
          ],
        },
        steps: [
          "Kamomadli materiallarni belgilang (sarlavhadagi belgi — hammasini birdan).",
          "«Xarid so'rovi yaratish» ni bosing.",
          "Har bir Loyiha uchun alohida qoralama so'rov ochiladi; muddati yaqin Loyiha birinchi ta'minlanadi. So'rovlar xarid birligida (dona tayoq) yoziladi.",
          "So'rovlarni tekshirib, «Tasdiqlashga yuborish» — keyingi yo'l «Ta'minot» bobida.",
        ],
      },
      {
        h: "Qaysi Loyihaga kerak",
        shot: {
          img: "mrp-open",
          caption: "Material qatori ochilgan",
          marks: [
            "Material nomini bosing — qator ochiladi",
            "Har bir Loyiha: qancha kerak, topshirish muddati, qanchasi ta'minlangan va qancha yetmaydi",
          ],
        },
      },
    ],
    faq: [
      ["MRP bo'sh.", "Ochiq Loyihalarda buyumlarga tarkibi bor mahsulot tanlanmagan, yoki Loyihalar hali qoralama. Qoralama Loyiha MRP ga kirmaydi."],
    ],
  },
  {
    id: "production-moves",
    part: "Ishlab chiqarish",
    pics: "production",
    pages: ["inventory"],
    title: "Sexda: materialdan mijozgacha",
    who: "Omborchi va ishlab chiqarish boshlig'i uchun",
    intro:
      "Loyiha kartasidagi «Ishlab chiqarish» menyusi — ishning uch qadami, ish qanday tartibda bo'lsa, shu tartibda. Har bir qadam bitta oyna: ro'yxat tayyor, tekshirasiz va bitta tugmani bosasiz — ombor harakatlari o'zi yaratiladi va o'tkaziladi.",
    to: "/projects",
    blocks: [
      {
        h: "«Ishlab chiqarish» menyusi",
        shot: {
          img: "prod-menu",
          caption: "Loyiha kartasi → Ishlab chiqarish",
          marks: [
            "1. Materiallarni sexga berish — ombordan chiqim",
            "2. Sexdan chiqqan tayyor mahsulotni omborga qabul qilish",
            "3. Tayyor mahsulotni mijozga yetkazish",
          ],
        },
      },
      {
        h: "1. Materiallarni berish (sexga)",
        shot: {
          img: "prod-issue",
          caption: "Materiallarni ishlab chiqarishga berish",
          marks: [
            "Ombor — material qaysi ombordan beriladi",
            "Har bir qolgan material: belgilangani beriladi. Miqdor = qolgan, lekin ombordagidan ko'p emas — o'zgartirish mumkin",
            "«Boshqa material qo'shish» — tarkibda yo'q material",
            "«Batafsil forma» — bitta harakatni to'liq forma bilan ochish",
            "«Berish» — belgilanganlarning hammasi birdan beriladi (qavsda — nechta)",
          ],
        },
        points: [
          "Omborda yetmasa, miqdor qizil bo'ladi — kamaytiring yoki boshqa omborni tanlang.",
          "Biror material o'tmasa (masalan, omborda yetarli emas), qolganlari baribir beriladi; o'tmaganlari sababi bilan ko'rsatiladi.",
          "Berilgan materiallar Loyiha materiallarida «Chiqim qilingan» ustuniga tushadi.",
        ],
      },
      {
        h: "2. Tayyor mahsulotni qabul qilish",
        shot: {
          img: "prod-output",
          caption: "Tayyor mahsulotni omborga qabul qilish",
          marks: [
            "Loyihaning tayyor mahsulotlari: buyurtmada nechta, nechtasi qabul qilingan; miqdor — qolgani",
            "«Qabul qilish» — mahsulot omborga kiradi",
          ],
        },
        tip: "Tayyor mahsulot tannarxi o'zi hisoblanadi: shu Loyihaga sexga berilgan materiallar summasi, soniga bo'linadi.",
      },
      {
        h: "3. Mijozga yetkazish",
        shot: {
          img: "prod-deliver",
          caption: "Tayyor mahsulotni mijozga yetkazish",
          marks: [
            "Kimga: Loyiha mijozi",
            "Omborda turgan tayyor mahsulot: qilingan, yetkazilgan va omborda qancha",
            "«Yetkazish» — mahsulot ombordan mijozga chiqadi",
          ],
        },
        points: [
          "Yetkazishdan keyin Loyiha bosqichini «Yetkazildi» ga o'tkazishni unutmang — bu Loyiha kartasidagi tugma.",
          "Har bir qadam ombor harakati bo'lib yoziladi: Loyiha kartasining tepasidagi ombor tugmasi («Ombor harakatlari» / «Ombor · chiqim…») ularni ko'rsatadi.",
        ],
      },
    ],
    faq: [
      ["«Ishlab chiqarish» menyusi yo'q.", "Sizda ombor harakati yaratish ruxsati yo'q yoki kartada saqlanmagan o'zgarish bor — avval saqlang."],
      ["Ro'yxat bo'sh: «Tarkib bo'yicha beriladigan material yo'q».", "Buyumlarga mahsulot tanlanmagan yoki hammasi allaqachon berilgan. Kerak bo'lsa, materialni pastdan qo'lda qo'shing."],
    ],
  },
];
