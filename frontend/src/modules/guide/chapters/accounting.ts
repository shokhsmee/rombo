// Qo'llanma → Buxgalteriya: the journal, invoices, reports, the chart and USD rates. Pictures: backend/scripts/guide/accounting.py
import type { GuideSection } from "../types";

export const CHAPTERS: GuideSection[] = [
  {
    id: "accounting-journal",
    part: "Buxgalteriya",
    pics: "accounting",
    pages: ["accounting"],
    title: "Jurnal: buxgalteriya o'tkazmalari",
    who: "Buxgalter uchun",
    intro:
      "Jurnal — barcha buxgalteriya o'tkazmalari (BX-…). Ularni hujjatlar o'zi yozadi: kassa orderi, ombor kirimi va harakati, hisob-faktura tasdiqlanganda. Qo'lda faqat boshlang'ich qoldiq va tuzatish kiritiladi.",
    to: "/accounting",
    blocks: [
      {
        h: "Jurnal ro'yxati",
        text: "Chap menyuda Buxgalteriya → Jurnal. Har bir qator — bitta o'tkazma: qaysi hujjatdan, qachon, qancha.",
        shot: {
          img: "journal",
          caption: "Buxgalteriya → Jurnal",
          marks: [
            "«Qo'lda o'tkazma» — boshlang'ich qoldiq yoki tuzatish kiritish",
            "Qidiruv: o'tkazma raqami yoki mazmuni bo'yicha",
            "Turi: Hujjat (o'zi yozilgan), Qo'lda, Storno",
            "Davr: qaysi sanadan qaysi sanagacha (yonida — Kontragent filtri)",
            "Qatorni bosing — o'tkazma ochiladi",
          ],
        },
        points: [
          "«Mazmuni» ostidagi kulrang yozuv — o'tkazmani yozgan hujjat va kim o'tkazgani.",
          "«Holat»: «O'tkazilgan» yoki «Storno qilingan» (yonida — storno o'tkazmasining raqami).",
        ],
      },
      {
        h: "O'tkazma ichida",
        shot: {
          img: "entry",
          caption: "Hisob-fakturadan yozilgan o'tkazma",
          marks: [
            "«Storno» — xato o'tkazmani bekor qilish (ko'zgu o'tkazma yoziladi)",
            "Manba hujjat — bosilsa, hisob-faktura yoki kassa orderi ochiladi",
            "Kim va qachon o'tkazgan",
            "Qatorlar: hisob, kontragent / loyiha, debet va kredit",
          ],
        },
        points: [
          "O'tkazilgan o'tkazmani tahrirlab bo'lmaydi. O'zgartirish yo'li — storno, keyin to'g'risini kiritish.",
          "Storno: sana va izoh so'raladi; debet va kredit almashtirilgan yangi o'tkazma yoziladi, asl o'tkazma «Storno qilingan» bo'ladi. Bir o'tkazmani ikki marta storno qilib bo'lmaydi.",
          "Hujjatdan yozilgan o'tkazmani odatda hujjatning o'zida bekor qilgan ma'qul (masalan, hisob-fakturada «Bekor qilish») — u storno'ni o'zi yozadi.",
        ],
      },
      {
        h: "Qo'lda o'tkazma",
        text: "Faqat ikki holatda: ish boshlanganda boshlang'ich qoldiqlarni kiritish va hujjat bilan tuzatib bo'lmaydigan xatoni to'g'rilash.",
        shot: {
          img: "manual",
          caption: "Jurnal → Qo'lda o'tkazma",
          marks: [
            "Mazmuni — majburiy: «Boshlang'ich qoldiq 01.11.2026»",
            "Hisob — har bir qatorda tanlang (guruh hisoblari ro'yxatda yo'q)",
            "«Qator qo'shish» — kamida ikki qator bo'ladi",
            "Debet va kredit jami — teng bo'lsa yashil, farq bo'lsa qizil «farq» chiqadi",
            "«O'tkazish» — faqat balanslangan o'tkazma saqlanadi",
          ],
        },
        steps: [
          "Sana va mazmunni yozing.",
          "Har qatorda hisobni tanlang va summani yo Debet, yo Kredit ustuniga yozing (ikkalasiga emas).",
          "Mijoz yoki yetkazib beruvchi qarzi bo'lsa — «Kontragent» va «Loyiha» ni ko'rsating, aks holda u ularning saldosiga tushmaydi.",
          "Dollar qatorida valyutani USD qiling: so'mdagi summa debet/kreditga, dollar summasi alohida maydonga yoziladi.",
          "«O'tkazish» ni bosing.",
        ],
        tip: "Boshlang'ich qoldiq ish boshlangan kundan bir kun oldingi sana bilan, 8330 / 8710 hisoblariga qarshi kiritiladi.",
      },
    ],
    faq: [
      ["«Davr yopilgan» xatosi chiqdi.", "Sozlamalar → Kompaniya → «Davr yopilgan sana» va undan oldingi kunlarga o'tkazma ham, storno ham qilib bo'lmaydi. Sanani o'zgartiring yoki rahbar davrni ochsin."],
      ["Kassir to'lov o'tkazdi, lekin jurnalga ruxsati yo'q. O'tkazma yozildimi?", "Ha. Hujjatlar o'tkazmani o'zi yozadi — buning uchun Jurnal ruxsati kerak emas, hujjatning o'z ruxsati yetarli."],
    ],
  },
  {
    id: "accounting-invoices",
    part: "Buxgalteriya",
    pics: "accounting",
    pages: ["invoices"],
    title: "Hisob-fakturalar",
    who: "Buxgalter va sotuv menejeri uchun",
    intro:
      "Hisob-faktura (HF-…) — mijozga yozilgan sotuv yoki yetkazib beruvchidan olingan xarid hujjati (ESF). Qoralama jurnalga ta'sir qilmaydi; «Tasdiqlash» bosilganda o'tkazma yoziladi.",
    to: "/accounting/invoices",
    blocks: [
      {
        h: "Hisob-fakturalar ro'yxati",
        shot: {
          img: "invoices",
          caption: "Buxgalteriya → Hisob-fakturalar",
          marks: [
            "«Yangi hisob-faktura» — qo'lda yaratish",
            "Turi: Mijozga (sotuv) yoki Yetkazib beruvchidan (xarid)",
            "Holat bo'yicha filtr — bir nechtasini birga tanlash mumkin",
            "Qatorni bosing — hisob-faktura ochiladi",
            "«O'tkazma» — tasdiqlangan hisob-faktura yozgan o'tkazma raqami",
          ],
        },
        tip: "Mijoz hisob-fakturasini Loyihadan chiqarish qulayroq: Loyiha kartasi → Moliya → «Hisob-faktura chiqarish». Qoralama loyihaning mijozi, buyurtma qatorlari (tur, m², soni), summasi, valyutasi va kursi bilan tayyor ochiladi.",
      },
      {
        h: "Qoralamani to'ldirish",
        shot: {
          img: "invoice-draft",
          caption: "Qoralama hisob-faktura",
          marks: [
            "«Tasdiqlash» — jurnalga o'tkazish",
            "Holat: Qoralama → Tasdiqlangan",
            "Loyiha — o'tkazma shu loyihaga bog'lanadi",
            "ESF № va ESF sanasi — soliq tizimidagi elektron hisob-faktura raqami",
            "Daromad hisobi (xaridda — Xarajat / aktiv): qator qaysi hisobga yozilishi",
            "Jami; kontragentning avansi bo'lsa — «Avans hisobga olinadi»",
          ],
        },
        points: [
          "Har bir qatorda nom, miqdor (0 dan katta) va narx bo'lishi shart.",
          "Valyuta USD bo'lsa, kurs maydoni chiqadi. Bo'sh qoldirilsa — shu kungi Markaziy bank kursi olinadi; u ham yo'q bo'lsa, tasdiqlab bo'lmaydi («Kurs kiritilmagan»).",
          "QQS ustuni faqat kompaniya QQS to'lovchi bo'lsa chiqadi (Sozlamalar → Kompaniya). Aks holda QQS 0 %.",
          "Qoralamani o'chirish mumkin; tasdiqlanganini — yo'q.",
        ],
      },
      {
        h: "Tasdiqlash",
        shot: {
          img: "invoice-confirm",
          caption: "«Tasdiqlash» bosilganda",
          marks: [
            "Nima yozilishi: mijozga — Dt 4010 / Kt 9010 (va QQS); yetkazib beruvchidan — Dt xarajat, QQS / Kt 6010",
            "«Tasdiqlash» — o'tkazma yoziladi, qatorlar qulflanadi",
          ],
        },
        tip: "Mijozning avansi (6310) bo'lsa, tasdiqlashda o'zi hisobga olinadi — qarz shuncha kamayadi.",
      },
      {
        h: "Tasdiqlangan hisob-faktura",
        shot: {
          img: "invoice-confirmed",
          caption: "Tasdiqlangan hisob-faktura",
          marks: [
            "«Bekor qilish» — o'tkazma storno qilinadi, hisob-faktura «Bekor qilingan» bo'ladi",
            "O'tkazma — bosilsa, jurnaldagi yozuv ochiladi",
            "Kontragent saldosi: qizil — u bizga qarz, yashil — biz unga qarz (yoki avans)",
            "Qatorlar qulflangan",
          ],
        },
        tip: "Xato bo'lsa — «Bekor qilish», keyin yangi hisob-faktura kiriting. Tasdiqlangan hisob-fakturani tahrirlab bo'lmaydi.",
      },
    ],
    faq: [
      ["«Tasdiqlash» tugmasi yo'q.", "Hisob-fakturani tahrirlash ruxsati kerak (Sozlamalar → Rollar va ruxsatlar → Hisob-fakturalar). Yoki saqlanmagan o'zgarish bor — avval «Saqlash» ni bosing."],
      ["Bekor qilingan hisob-fakturani qayta tasdiqlasa bo'ladimi?", "Yo'q. Yangi hisob-faktura kiriting."],
    ],
  },
  {
    id: "accounting-reports",
    part: "Buxgalteriya",
    pics: "accounting",
    pages: ["accounting_reports", "accounts"],
    title: "Hisobotlar, hisoblar rejasi va kurslar",
    who: "Buxgalter uchun",
    intro:
      "Hisobotlar jurnaldagi o'tkazmalardan har safar qayta hisoblanadi — hech qaerda alohida saqlangan qoldiq yo'q. Storno qilingan o'tkazmalar o'z stornosi bilan birga nolga chiqadi.",
    to: "/accounting/reports",
    blocks: [
      {
        h: "Oborot-saldo vedomosti",
        shot: {
          img: "trial",
          caption: "Buxgalteriya → Hisobotlar",
          marks: [
            "Hisobot turi: Oborot-saldo, Hisob kartochkasi, Solishtirma dalolatnoma",
            "Davr: dan — gacha (odatda joriy oy)",
            "Hisobni bosing — uning kartochkasi ochiladi",
            "Jami: debet va kredit har doim teng",
          ],
        },
        points: [
          "Har bir hisob bo'yicha: boshlang'ich qoldiq, davr oboroti va oxirgi qoldiq (debet / kredit).",
          "Hisob kartochkasi — tanlangan hisobning barcha qatorlari ketma-ket qoldiq bilan; kontragent bo'yicha ham filtrlash mumkin. Qatordagi o'tkazma raqamini bossangiz, o'tkazma ochiladi.",
        ],
      },
      {
        h: "Solishtirma dalolatnoma",
        text: "Mijoz yoki yetkazib beruvchi bilan hisob-kitobni solishtirish uchun. U kontragentning 4010, 6310, 6010 va 4310 hisoblaridan tuziladi.",
        shot: {
          img: "act",
          caption: "Hisobotlar → Solishtirma dalolatnoma",
          marks: [
            "Solishtirma dalolatnoma",
            "Kontragentni tanlang",
            "«Chop etish» — imzolash uchun bosma shakl",
            "Boshlang'ich va oxirgi saldo: «bizning foydamizga» — u bizga qarz",
            "Davr oboroti va yakuniy saldo",
          ],
        },
      },
      {
        h: "Hisoblar rejasi",
        text: "Buxgalteriya → Hisoblar rejasi: NSBU 21 hisoblari daraxt ko'rinishida. Qalin yozilgan qatorlar — guruh (ularga o'tkazma qilinmaydi).",
        shot: {
          img: "accounts",
          caption: "Hisoblar rejasi → Hisoblar",
          marks: [
            "Uch bo'lim: Hisoblar, Rollar, Kurslar",
            "Kod yoki nom bo'yicha qidirish",
            "Guruh hisobi",
            "Rol — o'tkazma qoidalari shu hisobni qaysi maqsadda ishlatadi",
            "«o'tkazmalar bor» — bu hisobni o'chirib bo'lmaydi",
            "Ishlatilgan hisob o'chirilmaydi — tahrirlashda «Faol» ni o'chiring",
          ],
        },
        points: [
          "«Hisob qo'shish»: kod (4 ta raqam), nomi, turi, guruhi.",
          "O'chirish (savat) faqat o'tkazmasi, ichki hisobi va roli yo'q hisobda chiqadi.",
        ],
      },
      {
        h: "Rollar: qaysi hujjat qaysi hisobga yozadi",
        text: "Hujjatlar hisob raqamini emas, rolni biladi: masalan, «Yetkazib beruvchilarga qarz» (ap_suppliers) → 6010.",
        shot: {
          img: "roles",
          caption: "Hisoblar rejasi → Rollar",
          marks: ["Rol va uning kaliti", "Hisob — boshqasini tanlasangiz, darhol saqlanadi"],
        },
        tip: "Rolni boshqa hisobga o'tkazsangiz, keyingi hujjatlar yangi hisobga yoziladi; eski o'tkazmalar o'zgarmaydi. Ehtiyot bo'ling — bu barcha hujjatlarga ta'sir qiladi.",
      },
      {
        h: "Markaziy bank kurslari",
        text: "Dollardagi hujjat (hisob-faktura, to'lov) so'mga shu kungi kurs bilan o'giriladi.",
        shot: {
          img: "rates",
          caption: "Hisoblar rejasi → Kurslar",
          marks: [
            "Kurslar: sana, valyuta, kurs va manba (Markaziy bank yoki Qo'lda)",
            "Kurs, so'm — shu kun uchun",
            "«Saqlash»",
            "Bugungi kurs hali yo'q — ogohlantirish",
            "Kurs qanday keladi: o'zi yoki qo'lda",
          ],
        },
        points: [
          "Avtomatik rejim yoqilgan bo'lsa, Markaziy bank kursi har kuni 09:10 va 18:10 da o'zi yuklanadi. Qo'lda kiritilgan kurs ustidan yozilmaydi.",
          "Server O'zbekistondan tashqarida bo'lsa, avtomatik yuklash o'chirib qo'yiladi — unda pastda «Kursni har kuni shu yerda kiriting» yozuvi chiqadi va kursni har kuni cbu.uz dan olib qo'lda kiritasiz.",
          "Bir kun uchun bitta USD kursi bo'ladi.",
        ],
        tip: "Kurs kiritilmagan kunga sanalgan dollar hujjatini tasdiqlab bo'lmaydi («Kurs kiritilmagan»), agar hujjatning o'zida kurs yozilmagan bo'lsa.",
      },
    ],
    faq: [
      ["Oborot-saldoda hisob ko'rinmayapti.", "Davrda unga o'tkazma bo'lmagan va boshlang'ich qoldig'i yo'q. Davrni kengaytiring."],
      ["Hisob raqamini o'zgartirish kerak (yangi reja).", "Yangi hisobni qo'shing va Rollar bo'limida rolni unga biriktiring. Eski hisobni nofaol qiling."],
    ],
  },
];
