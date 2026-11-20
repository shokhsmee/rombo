// Qo'llanma → Moliya: kassa and bank, cash orders, the cash book, money requests. Pictures: backend/scripts/guide/kassa.py
import type { GuideSection } from "../types";

export const CHAPTERS: GuideSection[] = [
  {
    id: "kassa-accounts",
    part: "Moliya",
    pics: "kassa",
    pages: ["kassa"],
    title: "Kassa va bank",
    who: "Kassir va buxgalter uchun",
    intro:
      "Bu yerda har bir naqd kassa va bank hisobi o'z qoldig'i bilan turadi. Qoldiq qo'lda yozilmaydi — u buxgalteriya jurnalidan olinadi. Pul faqat kirim / chiqim orderlari bilan harakatlanadi.",
    to: "/kassa",
    blocks: [
      {
        h: "Kassa va bank sahifasi",
        text: "Chap menyuda Moliya → Kassa va bank.",
        shot: {
          img: "kassa",
          caption: "Moliya → Kassa va bank",
          marks: [
            "Kirim — pul qabul qilish (PKO yoki bank kirimi)",
            "Chiqim — pul berish (RKO yoki to'lov topshiriqnomasi)",
            "O'tkazma — pulni bir hisobdan boshqasiga (masalan, kassadan bankka)",
            "Jami pul — barcha kassa va banklardagi pul, so'mda. Yonida: kassalarda, bankda, shu oy kirim va chiqim",
            "Pul so'rovlari — tasdiq kutayotgan so'rovlar soni (bosilsa, ro'yxat ochiladi)",
            "Kassa kartasi: buxgalteriya hisobi (5010…), qoldiq va tezkor tugmalar — orderlar, kassa kitobi, kirim, chiqim",
            "To'lov maqsadlari — har bir to'lov turining ro'yxati",
          ],
        },
        points: [
          "Dollar kassasida qoldiq dollarda, ostida so'mdagi qiymati ko'rinadi.",
          "Kassa limiti qo'yilgan bo'lsa va qoldiq undan oshsa, kartada «limitdan oshdi» yoziladi.",
          "«Qoralamalar» — hali o'tkazilmagan orderlar soni; bosilsa, ular ochiladi.",
        ],
      },
      {
        h: "Yangi kassa yoki bank hisobi",
        text: "«Yangi kassa / hisob» tugmasi (yoki kartadagi qalam) oynani ochadi.",
        shot: {
          img: "account-dialog",
          caption: "Yangi kassa / hisob oynasi",
          marks: [
            "Turi: Kassa (naqd) yoki Bank hisobi. Bankda bank nomi, MFO va hisob raqami ham so'raladi",
            "Valyuta: so'm yoki USD",
            "Buxgalteriya hisobi — bo'sh qolsa, turi va valyutasi bo'yicha o'zi tanlanadi",
            "Kassa limiti — oshsa, kassa kitobida ogohlantiradi (to'xtatmaydi)",
          ],
        },
        points: [
          "Orderi bor kassaning turi, valyutasi va hisobi o'zgarmaydi.",
          "Orderi bor kassani o'chirib bo'lmaydi — uni nofaol qiling.",
        ],
      },
      {
        h: "To'lov maqsadlari",
        text: "Har bir order maqsad bilan yoziladi: «Mijozdan to'lov», «Yetkazib beruvchiga to'lov», «Ish haqi», «Xarajat»… Maqsad pul buxgalteriyada qayerga yozilishini belgilaydi.",
        shot: {
          img: "purposes",
          caption: "Kassa va bank → To'lov maqsadlari",
          marks: [
            "Yo'nalish: kirim, chiqim yoki ikkalasi — orderda faqat mos maqsadlar chiqadi",
            "O'tkazma: mijoz va yetkazib beruvchi to'lovlari avval qarzni yopadi, qolgani avans bo'ladi; qolganlari ko'rsatilgan hisobga yoziladi",
            "Talab: orderda kontragent yoki xodim majburiy bo'ladimi",
            "Qatorni bosing — maqsadni tahrirlash",
          ],
        },
        tip: "Yangi maqsad ro'yxat ostidagi «Yangi maqsad» tugmasi bilan qo'shiladi. Odatda buni buxgalter qiladi.",
      },
    ],
    faq: [
      ["Kassadagi qoldiq qog'ozdagidan farq qilyapti.", "Qoldiq faqat o'tkazilgan orderlardan hisoblanadi. Qoralama qolgan orderlarni («Qoralamalar») va kassa kitobini kun bo'yicha tekshiring."],
    ],
  },
  {
    id: "kassa-orders",
    part: "Moliya",
    pics: "kassa",
    pages: ["cash_orders"],
    title: "Kirim va chiqim orderlari",
    who: "Kassir uchun",
    intro:
      "Har bir pul harakati — bitta order: kassaga kirim (PKO), kassadan chiqim (RKO), bank kirimi (BK), bank to'lovi (BT) yoki hisoblar orasida o'tkazma (OT). Order avval qoralama bo'ladi; «O'tkazish» dan keyin raqam oladi va jurnalga yoziladi.",
    to: "/kassa/orders",
    blocks: [
      {
        h: "Orderlar ro'yxati",
        shot: {
          img: "orders",
          caption: "Moliya → Kirim / chiqim",
          marks: [
            "Kirim — yangi kirim orderi",
            "Boshqa — chiqim (RKO / to'lov) yoki hisoblar orasida o'tkazma",
            "Turi bo'yicha: Barchasi, Kirim, Chiqim, O'tkazma",
            "Holat bo'yicha: Qoralama, O'tkazilgan, Bekor qilingan",
            "Kassa yoki bank hisobi bo'yicha filtr",
            "Qatorni bosing — order ochiladi. Yashil «+» — kirim, qizil «−» — chiqim",
          ],
        },
        points: [
          "Yana filtrlar: maqsad, kontragent, Loyiha va sana oralig'i.",
          "Qoralama orderning raqami hali yo'q — «№» ustunida «qoralama» yoziladi.",
          "«O'tkazma» ustuni — buxgalteriya jurnalidagi yozuv raqami.",
        ],
      },
      {
        h: "Yangi kirim",
        shot: {
          img: "order-new",
          caption: "Yangi kirim orderi",
          marks: [
            "Turi: kirim, chiqim yoki o'tkazma (saqlangandan keyin o'zgarmaydi)",
            "Kassa / bank — yonida hozirgi qoldig'i",
            "Maqsad — masalan, «Mijozdan to'lov»",
            "Summa — kassa valyutasida",
            "Kontragent — kim to'layapti (mijoz to'lovida majburiy)",
            "Loyiha — to'lov qaysi buyurtma uchun",
            "Saqlash — order qoralama bo'lib saqlanadi",
          ],
        },
        steps: [
          "«Kirim» tugmasini bosing.",
          "Kassani, maqsadni va summani tanlang.",
          "Kontragent va Loyihani tanlang. Kontragent ostida uning qarzi va avansi ko'rinadi.",
          "Kerak bo'lsa, hisob-fakturani tanlang — shunda faqat shu faktura bo'yicha qarz yopiladi, qolgani avans.",
          "«Asos» (shartnoma №, hisob-faktura…) va «Kimdan qabul qilindi» ni to'ldiring — ular orderda chop etiladi.",
          "«Saqlash», keyin «O'tkazish» ni bosing. Orderga raqam beriladi (PKO-00001).",
        ],
        tip: "Forma ostidagi «O'tkaziladi: …» qatori summa qanday taqsimlanishini oldindan ko'rsatadi: qancha qarzni yopadi, qanchasi avans bo'ladi.",
      },
      {
        h: "Loyihadan to'lov qabul qilish",
        text: "Loyiha kartasida (Moliya bo'limi) «To'lov qo'shish» tugmasi bor. U kirim orderini tayyor ochadi: mijoz, Loyiha, qarz summasi va asos to'ldirilgan bo'ladi.",
        shot: {
          img: "order-from-project",
          caption: "Loyiha → «To'lov qo'shish»",
          marks: [
            "Summa — Loyihaning qolgan qarzi (kerak bo'lsa o'zgartiring)",
            "Kontragent — Loyiha mijozi; ostida buxgalteriyadagi qarzi va avansi",
            "Loyiha — to'lov shu Loyihaga bog'lanadi",
            "Asos — «Loyiha LY-…» o'zi yoziladi",
            "Qanday o'tkazilishi: qarzni yopadi (4010) va/yoki avans (6310)",
          ],
        },
        points: [
          "Loyihaga bog'langan mijoz to'lovi o'tkazilgach, Loyihadagi «Avans» o'zi hisoblanadi — shu Loyihaga tushgan mijoz to'lovlari, qaytarilganlari ayirib. Qo'lda yozilgan avans almashtiriladi.",
          "Loyiha dollarda bo'lsa, dollar kassasi o'zi tanlanadi va Loyihadagi kurs olinadi. Dollar kassasi bo'lmasa, summa Loyiha kursi bilan so'mga o'giriladi.",
        ],
      },
      {
        h: "Dollar kassasi va kurs",
        shot: {
          img: "order-usd",
          caption: "Dollar kassasiga kirim",
          marks: [
            "Dollar kassasi tanlandi",
            "Summa dollarda",
            "Kurs — bo'sh qolsa, kun kursi olinadi; ostida so'mdagi qiymati",
          ],
        },
        points: ["Jurnalga so'mda (orderdagi kurs bo'yicha) yoziladi, dollardagi summa ham saqlanadi."],
      },
      {
        h: "O'tkazilgan order",
        shot: {
          img: "order-posted",
          caption: "O'tkazilgan PKO",
          marks: [
            "Bekor qilish — storno (pastga qarang)",
            "Chop etish — order blankasi (o'tkazmadan tashqari)",
            "Holat: Qoralama → O'tkazilgan",
            "O'tkazma — jurnaldagi yozuv (bosilsa ochiladi)",
            "Kontragent saldosi — hozirgi hisob-kitob holati",
            "O'tkazilgan order qulflangan",
          ],
        },
        points: [
          "Chiqim va o'tkazmada kassadagidan ko'p pul berib bo'lmaydi: «Kassada mablag' yetarli emas» xabari chiqadi.",
          "O'tkazma faqat bir xil valyutadagi hisoblar orasida bo'ladi.",
          "Faqat qoralamani o'chirsa bo'ladi. O'tkazilgan orderni tahrirlab ham, o'chirib ham bo'lmaydi.",
        ],
      },
      {
        h: "Bekor qilish (storno)",
        shot: {
          img: "order-cancel",
          caption: "«Bekor qilish» oynasi",
          marks: [
            "Jurnaldagi yozuvga teskari (ko'zgu) yozuv qilinadi, order «Bekor qilingan» bo'ladi",
            "Sabab — majburiy, tarixga yoziladi",
            "Tasdiqlash",
          ],
        },
        points: [
          "Xato order: bekor qiling va to'g'risini yangi order bilan kiriting.",
          "Kirim pulini allaqachon sarflangan bo'lsa (kassada yetarli qolmagan), uni bekor qilib bo'lmaydi.",
          "Yopilgan davr sanasidagi orderni bekor qilib bo'lmaydi.",
        ],
      },
    ],
    faq: [
      ["Orderni o'tkazdim, summani xato yozibman.", "O'tkazilgan orderni tahrirlab bo'lmaydi. «Bekor qilish» (sabab bilan) — keyin to'g'ri summa bilan yangi order kiriting."],
      ["Mijoz to'ladi, lekin Loyihada avans o'zgarmadi.", "Orderda Loyiha tanlanganini va order «O'tkazilgan» holatda ekanini tekshiring. Qoralama Loyihaga ta'sir qilmaydi."],
      ["«Kassada mablag' yetarli emas» chiqdi.", "Tanlangan kassada shuncha pul yo'q. Boshqa kassani tanlang yoki avval o'tkazma bilan pul o'tkazing."],
    ],
  },
  {
    id: "kassa-book",
    part: "Moliya",
    pics: "kassa",
    pages: ["cash_book"],
    title: "Kassa kitobi",
    who: "Kassir va buxgalter uchun",
    intro:
      "Kassa kitobi — bitta kassaning bitta kuni: kun boshiga qoldiq, shu kundagi o'tkazilgan orderlar, kun bo'yicha jami va kun oxiriga qoldiq. Hammasi jurnaldan olinadi va chop etiladi.",
    to: "/kassa/book",
    blocks: [
      {
        h: "Kunni ko'rish",
        text: "Moliya → Kassa kitobi (yoki kassa kartasidagi «Kassa kitobi» tugmasi).",
        shot: {
          img: "book",
          caption: "Kassa kitobi",
          marks: [
            "Kassa yoki bank hisobi",
            "Sana — yonidagi strelkalar oldingi / keyingi kun",
            "Bugun — bugungi kunga qaytish",
            "Chop etish — kitob varag'ini chop etish",
            "Kun boshiga qoldiq",
            "Order qatori: raqami bosilsa, order ochiladi",
            "Kun oxiriga qoldiq = kun boshi + kirim − chiqim",
          ],
        },
        points: [
          "Faqat o'tkazilgan orderlar ko'rinadi. Kunda order bo'lmasa — «Bu kunda order yo'q».",
          "Buxgalteriyada kassa hisobiga orderdan tashqari yozuv bo'lsa (boshlang'ich qoldiq, tuzatish), u alohida «Boshqa o'tkazmalar» qatorida chiqadi.",
          "Kun oxiridagi qoldiq kassa limitidan oshsa, yuqorida «Limitdan oshdi» belgisi chiqadi.",
        ],
        tip: "Kun yopilganda kassa kitobini chop eting va kassadagi naqd pul bilan solishtiring.",
      },
    ],
  },
  {
    id: "kassa-requests",
    part: "Moliya",
    pics: "kassa",
    pages: ["payment_requests"],
    title: "Pul so'rovlari",
    who: "Kassir, ta'minotchi va rahbar uchun",
    intro:
      "Ta'minot va boshqa bo'limlar kassadan pul so'raydi (masalan, yetkazib beruvchiga to'lov). Kassa so'rovni tasdiqlaydi yoki rad etadi, keyin chiqim orderi bilan to'laydi.",
    to: "/kassa/payment-requests",
    blocks: [
      {
        h: "So'rovlar ro'yxati",
        shot: {
          img: "requests",
          caption: "Moliya → Pul so'rovlari",
          marks: [
            "Yangi so'rov — qo'lda so'rov yaratish",
            "Holat bo'yicha filtr: «Kutilmoqda» — kassa qarorini kutayotganlar",
            "Qator: kontragent, asos, kim so'radi, summa va qancha to'langani",
          ],
        },
        points: [
          "Ta'minotda buyurtma (XB) kartasidagi «Pul so'rash» tugmasi shu buyurtma uchun so'rov yaratadi (summa — buyurtma jami, o'zgartirsa bo'ladi). Pul tasdiqlanmaguncha buyurtmani yetkazib beruvchiga yuborib bo'lmaydi.",
          "Kassa va bank sahifasidagi «Pul so'rovlari» raqami — kutilayotgan so'rovlar soni.",
        ],
      },
      {
        h: "So'rovning yo'li",
        steps: [
          "Qoralama → «Kassaga yuborish»: so'rov «Kutilmoqda» bo'ladi.",
          "Kutilmoqda → «Tasdiqlash» yoki «Rad etish». Rad etishda sabab majburiy — u so'rovchiga tarixda ko'rinadi. Bu tugmalar faqat tasdiqlash ruxsati borlarga chiqadi.",
          "Tasdiqlandi → «Pul berish»: chiqim orderi ochiladi.",
          "Shu so'rovga bog'langan chiqimlar o'tkazilib, summaga yetganda so'rov o'zi «To'langan» bo'ladi.",
        ],
        points: [
          "Qoralama, kutilayotgan va tasdiqlangan so'rovni «Bekor qilish» mumkin.",
          "«Kerak sana» o'tib ketgan va hali kutilayotgan so'rovda «Muddati o'tgan» belgisi chiqadi.",
        ],
      },
      {
        h: "Tasdiqlangan so'rov",
        shot: {
          img: "request",
          caption: "Tasdiqlangan pul so'rovi",
          marks: [
            "Pul berish — qolgan summa bilan chiqim orderini ochadi",
            "Holat: Qoralama → Kutilmoqda → Tasdiqlandi → To'langan",
            "Bekor qilish",
            "So'ralgan va to'langan summa; yonida — manba (Ta'minot buyurtmasi) va Loyiha",
            "To'lovlar — shu so'rov bo'yicha chiqim orderlari",
          ],
        },
      },
      {
        h: "Pul berish",
        shot: {
          img: "request-pay",
          caption: "«Pul berish» ochgan chiqim",
          marks: [
            "Maqsad — so'rovdagi maqsad (odatda «Yetkazib beruvchiga to'lov»)",
            "Summa — so'rovning hali to'lanmagan qismi",
            "Kontragent — ostida bizning qarzimiz va oldindan to'langan summa",
            "Pul so'rovi — chiqim shu so'rovga bog'langan",
            "Saqlash, keyin «O'tkazish»",
          ],
        },
        points: [
          "Pulni bo'lib berish mumkin: har bir chiqim so'rovdagi qoldiqni kamaytiradi.",
          "Bog'langan chiqim bekor qilinsa, so'rov yana «Tasdiqlandi» holatiga qaytadi.",
        ],
      },
    ],
    faq: [
      ["«Tasdiqlash» tugmasini ko'rmayapman.", "Pul so'rovini tasdiqlash uchun alohida ruxsat kerak. Rahbarga murojaat qiling (Sozlamalar → Rollar va ruxsatlar)."],
      ["Ta'minot buyurtmani yetkazib beruvchiga yubora olmayapti.", "Buyurtmaning pul so'rovi hali tasdiqlanmagan bo'lishi mumkin — «Avval kassa pulni tasdiqlasin». So'rovni tasdiqlang."],
    ],
  },
];
