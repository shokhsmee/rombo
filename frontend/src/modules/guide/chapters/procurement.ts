// Qo'llanma → Ta'minot: purchase request → approval → order → goods receipt, and suppliers.
// Pictures: backend/scripts/guide/procurement.py
import type { GuideSection } from "../types";

export const CHAPTERS: GuideSection[] = [
  {
    id: "purchase-request",
    part: "Ta'minot",
    pics: "procurement",
    pages: ["procurement"],
    title: "Xarid so'rovi",
    who: "Ta'minotchi va sotuv menejeri uchun",
    intro:
      "Material sotib olish uch hujjatdan o'tadi: Xarid so'rovi (nima kerak) → Buyurtma (kimdan, qanchaga) → Kirim (nima keldi). Har biri Loyihaga bog'langan. Xarid so'rovi — birinchi qadam: qaysi Loyiha uchun qancha material kerakligini yozadi.",
    to: "/procurement/requests",
    blocks: [
      {
        h: "Butun yo'l",
        steps: [
          "Xarid so'rovi: Loyiha uchun kerakli materiallar ro'yxati → «Tasdiqlashga yuborish».",
          "Tasdiqlash: rahbar (yoki bir nechta bosqich) so'rovni tasdiqlaydi yoki sabab bilan rad etadi.",
          "Buyurtma: tasdiqlangan so'rovdan «Buyurtma yaratish» — har bir yetkazib beruvchiga alohida buyurtma. Kassadan pul so'raladi, keyin buyurtma yetkazib beruvchiga yuboriladi.",
          "Kirim: tovar kelganda buyurtmadan «Kirim qilish» → miqdorlarni tekshirib «O'tkazish». Tovar omborga kiradi.",
        ],
        points: [
          "So'rov holatlari: Qoralama → Tasdiqlashga → Tasdiqlangan → Buyurtma qilingan (yon yo'llar: Rad etilgan, Bekor qilindi).",
          "Buyurtma holatlari: Qoralama → Yuborilgan → Qisman kelgan → Kelgan.",
          "Kirim holatlari: Qoralama → O'tkazilgan.",
        ],
      },
      {
        h: "Xarid so'rovlari ro'yxati",
        text: "Chap menyuda Ta'minot → Xarid so'rovlari.",
        shot: {
          img: "req-list",
          caption: "Ta'minot → Xarid so'rovlari",
          marks: [
            "«Yangi so'rov» — so'rovni qo'lda ochish",
            "Holat bo'yicha filtr: bir nechtasini birdan tanlash mumkin, yonidagi raqam — shu holatdagi so'rovlar soni",
            "Qidiruv: so'rov kodi, Loyiha kodi yoki nomi, material nomi bo'yicha",
            "«Tasdiq kutmoqda» — tasdiqlashga yuborilgan, hali qaror chiqmagan so'rovlar",
            "Qatorni bosing — so'rov ochiladi",
          ],
        },
      },
      {
        h: "Loyihadan bir tugma bilan",
        text: "Eng tez yo'l — so'rovni Loyiha kartasidan ochish. Loyihada hisob-kitob bo'lsa, tepada «Xaridga yuborish» tugmasi chiqadi.",
        shot: {
          img: "from-project",
          caption: "Loyiha kartasi",
          marks: ["«Xaridga yuborish» — Loyihaning barcha hisob-kitob qatorlari (miqdori 0 dan katta) bilan yangi so'rov ochiladi"],
        },
        points: [
          "So'rov «Qoralama» holatida ochiladi — qatorlarni tekshirib, keraksizini o'chiring yoki miqdorni to'g'rilang.",
          "Loyihaning «Materiallar (tarkib bo'yicha)» blokidagi «Xarid so'rovi» tugmasi esa tarkib (BOM) bo'yicha hali so'ralmagan materiallardan so'rov ochadi — «Ishlab chiqarish» bobiga qarang.",
          "MRP sahifasidan ham kamomad bo'yicha so'rov yaratiladi.",
        ],
      },
      {
        h: "So'rovni qo'lda ochish",
        shot: {
          img: "req-new",
          caption: "Yangi xarid so'rovi",
          marks: [
            "Loyiha — majburiy: material qaysi buyurtma uchun",
            "Kerak sana — material qachongacha kelishi kerak",
            "«Qator qo'shish» — material nomi (ombordagi mahsulotdan tanlash mumkin), birligi va miqdori",
            "Saqlash",
          ],
        },
        steps: [
          "«Yangi so'rov» ni bosing va Loyihani tanlang.",
          "Qatorlarni qo'shing. Mahsulot ro'yxatdan tanlansa, nomi va birligi o'zi to'ladi.",
          "«Saqlash» ni bosing. Saqlangandan keyin qatorlar ostida «Hisob-kitobdan olish» chiqadi — Loyiha hisob-kitobidagi qatorlarni miqdori bilan ko'chiradi.",
          "Tayyor bo'lsa — «Tasdiqlashga yuborish».",
        ],
        tip: "Qatorlarni faqat «Qoralama» holatida o'zgartirish mumkin. Rad etilgan yoki yuborilgan so'rovni tuzatish uchun «Qoralamaga qaytarish» ni bosing.",
      },
      {
        h: "So'rov kartasi",
        shot: {
          img: "req-card",
          caption: "Buyurtma qilingan so'rov",
          marks: [
            "Holat chizig'i: ko'k — hozirgi holat",
            "Buyurtmada: nechta qator buyurtmaga aylangani; bosilsa — shu Loyiha buyurtmalari",
            "«Buyurtmada» ustuni: yashil — to'liq buyurtma qilingan, sariq — qisman",
            "Tasdiqlash bosqichlari — pastda, keyingi bo'limda",
          ],
        },
        tip: "Hamma qatorlar to'liq buyurtmaga aylansa, so'rov o'zi «Buyurtma qilingan» bo'ladi.",
      },
    ],
    faq: [
      ["«Xaridga yuborish» tugmasi yo'q.", "Loyihada hisob-kitob yo'q yoki sizda xarid so'rovi yaratish ruxsati yo'q. So'rovni qo'lda oching yoki rahbarga murojaat qiling."],
      ["Qatorni o'zgartira olmayapman.", "So'rov qoralama emas. «Qoralamaga qaytarish» faqat «Tasdiqlashga» va «Rad etilgan» holatlarida bor; tasdiqlangan so'rovni bekor qilib, yangisini oching."],
    ],
  },
  {
    id: "purchase-approval",
    part: "Ta'minot",
    pics: "procurement",
    pages: ["procurement", "approval_steps"],
    title: "So'rovni tasdiqlash",
    who: "Rahbar va ta'minot boshlig'i uchun",
    intro:
      "Pul sarflashdan oldin so'rovni mas'ul odam tasdiqlaydi. Bosqichlar sozlanmagan bo'lsa — bitta tasdiq yetadi. Sozlangan bo'lsa — so'rov bosqichma-bosqich o'tadi: masalan, avval Ta'minot boshlig'i, keyin Direktor.",
    to: "/procurement/requests",
    blocks: [
      {
        h: "Tasdiqlash yoki rad etish",
        text: "So'rov «Tasdiqlashga yuborish» dan keyin birinchi faol bosqichda kutadi. Navbat sizga kelganda so'rov kartasida «Tasdiqlash · <bosqich nomi>» va «Rad etish» tugmalari chiqadi.",
        shot: {
          img: "req-approvals",
          caption: "So'rov kartasining pastki qismi",
          marks: [
            "Bosqichlar: yashil ✓ — o'tgan, ko'k — hozir kutayotgan, kulrang — navbatdagi. Yonida — kim tasdiqlaydi (rol)",
            "Har bir qaror: kim, qachon, tasdiqladimi yoki rad etdimi, sababi bilan",
          ],
        },
        points: [
          "Bosqichni faqat o'sha rolning faol a'zosi tasdiqlaydi. Boshqa odam bosqichni o'tkaza olmaydi.",
          "Oxirgi bosqich tasdiqlasa, so'rov «Tasdiqlangan» bo'ladi va «Buyurtma yaratish» tugmasi chiqadi.",
          "«Rad etish» uchun sabab yozish majburiy — u so'rovchiga tarixda ko'rinadi. Rad etilgan so'rov qoralamaga qaytarilib, qayta yuborilsa, tasdiqlash yana birinchi bosqichdan boshlanadi.",
          "Bosqichlar sozlanmagan bo'lsa: «So'rovlarni tasdiqlash» ruxsati bor odam yuborsa, so'rov darhol tasdiqlanadi; ruxsati yo'q odam yuborsa — tasdiq kutadi.",
        ],
        tip: "Ro'yxatdagi «Tasdiq kutmoqda» tugmasi — qaror kutayotgan barcha so'rovlarni bir joyda ko'rsatadi.",
      },
      {
        h: "Tasdiqlash bosqichlarini sozlash",
        text: "Sozlamalar → Tasdiqlash bosqichlari. Bu yerda kim va qaysi tartibda tasdiqlashi belgilanadi.",
        shot: {
          img: "steps",
          caption: "Sozlamalar → Tasdiqlash bosqichlari",
          marks: [
            "«Bosqich qo'shish» — yangi bosqich",
            "Bosqich: tartib raqami, nomi, holati; qalam belgisi — tahrirlash",
            "Kim tasdiqlaydi — rol. Shu rolning faol a'zolaridan biri tasdiqlasa yetadi",
          ],
        },
      },
      {
        h: "Bosqichni tahrirlash",
        shot: {
          img: "step-edit",
          caption: "Bosqich oynasi",
          marks: [
            "Tartib — kichik raqam oldin keladi (10, 20, 30…)",
            "Nomi — so'rovda shu nom ko'rinadi: «Ta'minot boshlig'i»",
            "Rol — kim tasdiqlaydi",
            "Faol — o'chirilgan bosqich o'tkazib yuboriladi",
          ],
        },
        tip: "Bosqichni o'chirgandan ko'ra nofaol qilgan ma'qul — o'tgan qarorlar tarixda qoladi, kutayotgan so'rovlar to'xtab qolmaydi.",
      },
    ],
    faq: [
      ["Tasdiqlash tugmasi menda chiqmayapti.", "So'rov hozir boshqa bosqichda kutyapti yoki siz shu bosqich rolining a'zosi emassiz. Kartadagi ko'k bosqichga qarang — yonida rol yozilgan."],
    ],
  },
  {
    id: "purchase-order",
    part: "Ta'minot",
    pics: "procurement",
    pages: ["purchase_orders"],
    title: "Buyurtma: yetkazib beruvchiga",
    who: "Ta'minotchi uchun",
    intro:
      "Buyurtma — yetkazib beruvchiga beriladigan hujjat: nima, qancha, qaysi narxda. Kassa pulni tasdiqlagach, buyurtma yetkazib beruvchiga yuboriladi va qatorlari qulflanadi.",
    to: "/procurement/orders",
    blocks: [
      {
        h: "Tasdiqlangan so'rovdan buyurtma",
        steps: [
          "Tasdiqlangan so'rovni oching va «Buyurtma yaratish» ni bosing.",
          "Oynada har qator uchun yetkazib beruvchini tanlang yoki tepadagi «Hammasi uchun:» maydonida bittasini tanlang. Keraksiz qatorning belgisini olib tashlang, miqdorni kamaytirish mumkin.",
          "«Yaratish» ni bosing. Yetkazib beruvchi har xil bo'lsa — har biriga alohida buyurtma ochiladi («2 ta buyurtma yaratish»).",
          "Buyurtmada narxlarni tekshiring: narx shu yetkazib beruvchidan oxirgi kirimdagi narx bilan o'zi to'ladi.",
        ],
        tip: "Buyurtmani «Yangi buyurtma» tugmasi bilan qo'lda ham ochish mumkin. Loyiha maydoni ixtiyoriy — bir nechta Loyiha uchun umumiy buyurtmada bo'sh qoldiring.",
      },
      {
        h: "Buyurtmalar ro'yxati",
        text: "Ta'minot → Buyurtmalar.",
        shot: {
          img: "ord-list",
          caption: "Ta'minot → Buyurtmalar",
          marks: [
            "Holat bo'yicha filtr",
            "Qidiruv: kod, yetkazib beruvchi, Loyiha bo'yicha; yonida — yetkazib beruvchi va Loyiha filtri",
            "Qatorni bosing — buyurtma ochiladi",
          ],
        },
      },
      {
        h: "Buyurtma kartasi",
        shot: {
          img: "ord-card",
          caption: "Yuborilgan buyurtma",
          marks: [
            "Holat: Qoralama → Yuborilgan → Qisman kelgan → Kelgan",
            "«Yuborish» (yuborilgandan keyin — «Qayta yuborish»)",
            "Pul so'rovi holati kassada; bosilsa — pul so'rovi ochiladi",
            "«Kirim qilish» — tovar kelganda kirim hujjatini ochadi",
            "Yuborilgan buyurtma qatorlari qulflangan",
            "Yetkazib beruvchi bilan hisob: «Qarzimiz» — biz qarzmiz, «Avans» — oldindan to'langan",
          ],
        },
        points: [
          "Qoralama buyurtmada avval «Pul so'rash» chiqadi: summa (odatda buyurtma jami) va izoh yoziladi, «Kassaga yuborish» bosiladi.",
          "Kassa pul so'rovini tasdiqlamaguncha «Yuborish» ishlamaydi — yonida «Avval kassa pulni tasdiqlasin» yozuvi turadi.",
          "«Chop etish» — buyurtmaning bosma shakli (rekvizitlar, qatorlar, QQS bilan).",
          "«Bekor qilish» — sabab bilan. Kirim o'tkazilgan buyurtmani bekor qilib bo'lmaydi. Bekor qilinganda so'rov qatorlari yana buyurtma uchun ochiladi.",
        ],
      },
      {
        h: "Qatorlar va summa",
        shot: {
          img: "ord-lines",
          caption: "Buyurtma qatorlari",
          marks: [
            "Keldi — kirim qilingan miqdor: yashil — to'liq, sariq — qisman",
            "Narx buyurtma valyutasida (so'm yoki USD); USD bo'lsa kurs majburiy",
            "Jami: QQSsiz, QQS va umumiy summa",
          ],
        },
        tip: "Qatorlarni faqat «Qoralama» holatida o'zgartirish mumkin. Yuborilgandan keyin faqat kutilayotgan sana va izoh o'zgaradi — xato bo'lsa, buyurtmani bekor qilib yangisini oching.",
      },
      {
        h: "Yetkazib beruvchiga yuborish",
        shot: {
          img: "ord-send",
          caption: "«Yuborish» oynasi",
          marks: [
            "Qanday yuborildi: Chop etib, Email yoki Boshqa",
            "Kimga / qanday: kuryer, Telegram… Email tanlansa — yetkazib beruvchi kartasidagi manzil o'zi qo'yiladi",
            "«Yuborildi deb belgilash» (Email uchun — «Email yuborish»)",
          ],
        },
        points: [
          "Kim, qachon va qanday yuborgani tarixga yoziladi; buyurtma «Yuborilgan» bo'ladi.",
          "«Chop etib» tanlansa, bosma shakl yangi oynada ochiladi.",
          "Loyihaning qatorlari bor birinchi buyurtma yuborilganda, «Tasdiqlangan» Loyiha o'zi «Xaridda» bosqichiga o'tadi.",
        ],
      },
    ],
    faq: [
      ["«Yuborish» tugmasi kulrang.", "Kassa pul so'rovini hali tasdiqlamagan. Pul so'rovi holati tugmalar yonida ko'rinadi."],
      ["Email yuborilmadi: «Email sozlanmagan».", "Tizimda pochta sozlanmagan. «Chop etib» yoki «Boshqa» bilan yuboring va administratorga ayting."],
    ],
  },
  {
    id: "goods-receipt",
    part: "Ta'minot",
    pics: "procurement",
    pages: ["goods_receipts"],
    title: "Kirim: kelgan tovarni qabul qilish",
    who: "Omborchi va ta'minotchi uchun",
    intro:
      "Kirim — yetkazib beruvchidan kelgan tovar. U doim buyurtmadan ochiladi. «O'tkazish» bosilganda tovar omborga kiradi, buyurtmadagi «Keldi» ko'payadi va yetkazib beruvchiga qarz buxgalteriyaga yoziladi.",
    to: "/procurement/receipts",
    blocks: [
      {
        h: "Kirim ochish",
        steps: [
          "Buyurtmani oching (holati «Yuborilgan» yoki «Qisman kelgan»).",
          "«Kirim qilish» ni bosing — qoralama kirim ochiladi, qolgan miqdorlar o'zi yozilgan.",
          "Kelgan miqdorni sanab, «Keldi» ustunida to'g'rilang.",
          "Yetkazib beruvchining hisob-fakturasi (ESF) raqami, sanasi va summasini kiriting.",
          "«Saqlash», keyin «O'tkazish».",
        ],
      },
      {
        h: "Kirimlar ro'yxati",
        text: "Ta'minot → Kirim. Qidiruv kod, buyurtma va hisob-faktura raqami bo'yicha; yetkazib beruvchi va Loyiha filtri bor.",
        shot: {
          img: "rcp-list",
          caption: "Ta'minot → Kirim",
          marks: [
            "Holat bo'yicha filtr: «Qoralama» — hali o'tkazilmagan kirimlar",
            "Qatorni bosing — kirim ochiladi",
          ],
        },
      },
      {
        h: "Kirim kartasi",
        shot: {
          img: "rcp-draft",
          caption: "Qoralama kirim",
          marks: [
            "«O'tkazish» — tovar omborga kiradi, hujjat jurnalga yoziladi (o'zgarish saqlangan bo'lishi kerak)",
            "Qaysi buyurtmadan — bosilsa, buyurtma ochiladi",
            "Ombor — tovar qaysi omborga kiradi (bo'sh — asosiy ombor)",
            "Yetkazib beruvchi hisob-fakturasi (ESF): summasi kirimdan farq qilsa, ogohlantirish chiqadi",
          ],
        },
      },
      {
        h: "Qatorlar: nima keldi",
        shot: {
          img: "rcp-lines",
          caption: "Kelgan tovar",
          marks: [
            "Ombordagi mahsulot — tovar qaysi mahsulot bo'lib kiradi: buyurtmadan, nomi bo'yicha topilgan yoki yangi yaratiladi (turkumini tanlang)",
            "Avval keldi — oldingi kirimlarda qabul qilingan miqdor",
            "Keldi — hozir kelgan miqdor; buyurtmadagi qoldiqdan ko'p bo'lmaydi",
          ],
        },
        points: [
          "Qisman kelsa — kelganini yozing va o'tkazing. Buyurtma «Qisman kelgan» bo'ladi; qolgani kelganda yana «Kirim qilish».",
          "Hammasi kelgach, buyurtma o'zi «Kelgan» bo'ladi.",
          "Birlik o'zi o'giriladi: masalan, 10 dona 6,5 metrlik profil omborga 65 m bo'lib kiradi.",
          "Narx buyurtmadan olinadi. Narx noto'g'ri bo'lsa — buyurtmada to'g'rilash kerak.",
        ],
      },
      {
        h: "O'tkazilgan kirim",
        shot: {
          img: "rcp-posted",
          caption: "O'tkazilgan kirim",
          marks: [
            "Holat: O'tkazilgan",
            "«Bekor qilish (storno)» — teskari yozuv, kelgan miqdor buyurtmaga qaytadi",
            "Ombor harakatlari — qaysi omborga nechta qator kirgan",
            "Jurnal — qachon va kim o'tkazgan",
          ],
        },
        tip: "Tovarning bir qismi allaqachon sexga berilgan bo'lsa, kirimni bekor qilib bo'lmaydi.",
      },
    ],
    faq: [
      ["«Keldi» ga ko'p yozsam xato chiqyapti.", "Bitta kirim buyurtmada qolgan miqdordan ko'p qabul qila olmaydi. Ortiqcha kelgan bo'lsa — yetkazib beruvchi bilan yangi buyurtma oching."],
      ["Yopilgan oy sanasi bilan o'tkazib bo'lmayapti.", "Buxgalteriyada shu sanagacha davr yopilgan. Sanani o'zgartiring yoki buxgalterga murojaat qiling."],
    ],
  },
  {
    id: "suppliers",
    part: "Ta'minot",
    pics: "procurement",
    pages: ["suppliers"],
    title: "Yetkazib beruvchilar",
    who: "Ta'minotchi va buxgalter uchun",
    intro:
      "AKFA, oyna zavodi, furnitura sotuvchisi — har biri bitta karta: rekvizitlar, to'lov shartlari va hisob-kitob holati (saldo). Saldo buxgalteriya jurnalidan o'zi hisoblanadi.",
    to: "/procurement/suppliers",
    blocks: [
      {
        h: "Ro'yxat",
        shot: {
          img: "sup-list",
          caption: "Ta'minot → Yetkazib beruvchilar",
          marks: [
            "«Yangi yetkazib beruvchi»",
            "Shartlar: oldindan to'lov foizi va kredit kunlari",
            "Saldo: qizil «qarz» — biz qarzmiz, yashil «avans» — oldindan to'laganmiz",
            "Qatorni bosing — karta ochiladi",
          ],
        },
      },
      {
        h: "Yetkazib beruvchi kartasi",
        shot: {
          img: "sup-card",
          caption: "Yetkazib beruvchi kartasi",
          marks: [
            "Email — buyurtma email bilan shu manzilga yuboriladi",
            "Bank rekvizitlari: hisob raqami, bank, MFO",
            "Narx valyutasi — yangi buyurtma shu valyutada ochiladi (so'm yoki USD)",
            "Oldindan to'lov, %",
            "Kredit kunlari — to'lov muddati",
          ],
        },
        points: [
          "Kartaning tepasida: saldo («Qarzimiz» yoki «Avans berilgan») va buyurtmalar soni — bosilsa, shu yetkazib beruvchining buyurtmalari ochiladi.",
          "Ishlamay qo'ygan yetkazib beruvchini o'chirmang — «Faol» belgisini olib tashlang.",
        ],
      },
    ],
  },
];
