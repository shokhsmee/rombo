// Qo'llanma → Ombor: stock moves, balances, products and warehouses. Pictures: backend/scripts/guide/inventory.py
import type { GuideSection } from "../types";

export const CHAPTERS: GuideSection[] = [
  {
    id: "inventory-moves",
    part: "Ombor",
    pics: "inventory",
    pages: ["inventory"],
    title: "Ombor harakatlari",
    who: "Omborchi uchun",
    intro:
      "Ombordagi har bir harakat — bitta qator: kirim, chiqim, ishlab chiqarish, yetkazish, ko'chirish, tuzatish. Qoldiq shu qatorlardan hisoblanadi. Harakat avval qoralama bo'ladi, «O'tkazish» dan keyin qoldiq va buxgalteriya jurnali yangilanadi.",
    to: "/inventory/moves",
    blocks: [
      {
        h: "Harakatlar ro'yxati",
        text: "Chap menyuda Ombor → Ombor. Yuqorida — o'tkazilgan harakatlar jami, pastda — har bir harakat.",
        shot: {
          img: "moves",
          caption: "Ombor → Ombor",
          marks: [
            "«Chiqim» — materialni ishlab chiqarishga berish (eng ko'p ishlatiladigan harakat)",
            "«Boshqa» — ishlab chiqarish, yetkazish, ko'chirish va tuzatish",
            "Kirim, chiqim, yetkazish summalari (so'mda) — bosilsa, ro'yxat shu turga filtrlanadi",
            "Ombordagi qoldiq qiymati — bosilsa, «Qoldiqlar» sahifasi ochiladi",
            "Tur bo'yicha filtr: bir nechtasini birdan tanlash mumkin",
            "Holat bo'yicha filtr: Qoralama, O'tkazilgan, Bekor qilingan",
            "Qatorni bosing — harakat ochiladi. Miqdor yashil «+» — omborga kirdi, qizil «−» — chiqdi",
          ],
        },
        points: [
          "Yana filtrlar: ombor, turkum, mahsulot, Loyiha va sana oralig'i. Yuqoridagi summalar ham filtrga qarab hisoblanadi.",
          "«Hujjat» ustuni — harakat qaysi hujjatdan kelgani (masalan, ta'minot kirimi KR) yoki buxgalteriya o'tkazmasi raqami.",
        ],
      },
      {
        h: "Harakat turlari",
        shot: {
          img: "moves-menu",
          caption: "«Boshqa» menyusi",
          marks: ["«Boshqa» tugmasi", "Qo'lda yoziladigan qolgan turlar"],
        },
        points: [
          "Kirim — yetkazib beruvchidan kelgan mol. Qo'lda yozilmaydi: Ta'minot → Kirim (KR) o'tkazilganda o'zi paydo bo'ladi.",
          "Chiqim — materialni Loyiha ishlab chiqarishiga berish. Loyiha majburiy.",
          "Ishlab chiqarish — tayyor mahsulot sexdan omborga kirdi. Faqat «Tayyor mahsulot» turkumidagi mahsulot, Loyiha majburiy. Tannarx bo'sh qolsa — Loyihaga berilgan materiallar qiymati olinadi.",
          "Yetkazish — tayyor mahsulot mijozga ketdi. Loyiha majburiy; mijoz Loyihadan olinadi.",
          "Ko'chirish — bir ombordan boshqasiga. «Qayerdan» va «Qayerga» har xil bo'lishi kerak.",
          "Tuzatish — sanoqdan keyin: ortiqcha chiqsa musbat (5), kamomad bo'lsa manfiy (−2) miqdor yoziladi.",
        ],
      },
      {
        h: "Yangi harakat (chiqim)",
        shot: {
          img: "move-new",
          caption: "Yangi chiqim",
          marks: [
            "Turi — ostida u nima ekanligi va qaysi hisoblarga yozilishi ko'rsatiladi",
            "Mahsulot — chiqim, yetkazish va ko'chirishda faqat shu omborda bori ro'yxatda chiqadi",
            "Ombor — yangi harakatda asosiy ombor o'zi tanlanadi",
            "Miqdor — mahsulotning ombor birligida (m, m2, dona…)",
            "Loyiha — chiqim, ishlab chiqarish va yetkazishda majburiy",
            "Saqlash — harakat qoralama bo'lib saqlanadi, qoldiq hali o'zgarmaydi",
          ],
        },
        steps: [
          "Ombor → Ombor sahifasida «Chiqim» ni (yoki «Boshqa» dan kerakli turni) bosing.",
          "Mahsulotni tanlang — ostida barcha omborlardagi qoldig'i va o'rtacha tannarxi chiqadi.",
          "Omborni, miqdorni va Loyihani kiriting.",
          "«Saqlash» ni bosing — qoralama tayyor.",
          "Tekshirib, «O'tkazish» ni bosing.",
        ],
        tip: "Mahsulot kartasidagi «Chiqim» (tayyor mahsulotda «Yetkazish») tugmasi shu mahsulot tanlangan formani ochadi.",
      },
      {
        h: "Qoralamani o'tkazish",
        shot: {
          img: "move-draft",
          caption: "Qoralama harakat",
          marks: [
            "O'tkazish — qoldiq va jurnal yangilanadi; keyin o'zgartirib bo'lmaydi",
            "Holat: Qoralama → O'tkazilgan",
            "Shu omborda hozir qancha borligi",
            "Omborda yetarli bo'lmasa, ogohlantirish chiqadi — o'tkazish rad etiladi",
            "O'chirish — faqat qoralamani o'chirsa bo'ladi",
          ],
        },
        points: [
          "Ombordagidan ko'p chiqarib bo'lmaydi: tizim «Omborda yetarli emas» deb to'xtatadi. Avval kirimni o'tkazing.",
          "Chiqib ketayotgan mol o'rtacha tannarx bo'yicha baholanadi. Qoralamada «Taxminiy summa» ko'rinadi, aniq summa o'tkazilganda hisoblanadi.",
          "Yopilgan davr sanasi bilan o'tkazib bo'lmaydi (buxgalteriya yopgan sana).",
        ],
      },
      {
        h: "O'tkazilgan harakat va bekor qilish",
        shot: {
          img: "move-posted",
          caption: "O'tkazilgan chiqim",
          marks: [
            "Bekor qilish — sabab yoziladi, buxgalteriya o'tkazmasi storno qilinadi va qoldiq qaytadi",
            "Summa va bir birlik tannarxi",
            "O'tkazma — buxgalteriya jurnalidagi yozuv (bosilsa ochiladi)",
            "Loyiha — bosilsa, Loyiha kartasi ochiladi",
            "O'tkazilgan harakatning maydonlari qulflangan",
          ],
        },
        points: [
          "Xato bo'lsa — bekor qiling va yangi harakat kiriting. O'tkazilgan harakatni tahrirlab bo'lmaydi.",
          "Kirim qatorlarida «Bekor qilish» yo'q: ularni Ta'minotdagi kirim hujjatini (KR) bekor qilib qaytariladi.",
          "Mol allaqachon chiqib ketgan bo'lsa, ishlab chiqarish yoki ko'chirishni bekor qilib bo'lmaydi — qoldiq manfiyga tushib qoladi.",
        ],
      },
    ],
    faq: [
      ["Nega kirim tugmasi yo'q?", "Mol ombor kirimi faqat Ta'minot → Kirim (KR) orqali keladi. KR o'tkazilganda ombor qatorlari o'zi yoziladi."],
      ["«Omborda yetarli emas» chiqdi.", "Tanlangan omborda shuncha mol yo'q. Qoldiqlar sahifasini tekshiring: mol boshqa omborda bo'lishi yoki kirim hali o'tkazilmagan bo'lishi mumkin."],
      ["Loyihaga qancha material ketganini qanday ko'raman?", "Ro'yxatda «Loyiha» filtrini tanlang — yuqoridagi summalar ham faqat shu Loyiha bo'yicha hisoblanadi. Loyiha kartasidagi «Ombor harakatlari» tugmasi ham shu ro'yxatni ochadi."],
    ],
  },
  {
    id: "inventory-stock",
    part: "Ombor",
    pics: "inventory",
    pages: ["stock"],
    title: "Qoldiqlar",
    who: "Omborchi, ta'minotchi va buxgalter uchun",
    intro:
      "Qoldiqlar — har bir mahsulot har bir omborda qancha bor va qancha turadi. Raqamlar qo'lda yozilmaydi: ular o'tkazilgan harakatlar yig'indisi.",
    to: "/inventory/stock",
    blocks: [
      {
        h: "Qoldiqlar sahifasi",
        text: "Chap menyuda Ombor → Qoldiqlar. Har qator — bitta mahsulot bitta omborda.",
        shot: {
          img: "stock",
          caption: "Ombor → Qoldiqlar",
          marks: [
            "Ombordagi jami qiymat, so'mda",
            "Ombor bo'yicha filtr (yonida — turkum bo'yicha)",
            "«Nol qoldiqlar ham» — qoldig'i tugagan mahsulotlarni ham ko'rsatish",
            "Excel — ro'yxatni yuklab olish",
            "Qatorni bosing — shu mahsulotning shu ombordagi o'tkazilgan harakatlari ochiladi",
          ],
        },
        points: [
          "Kirim, ishlab chiqarish, ortiqcha (tuzatish) va ko'chirib kelingan mol qoldiqni oshiradi; chiqim, yetkazish, kamomad va ko'chirib ketilgan mol kamaytiradi.",
          "O'rtacha tannarx = qiymat ÷ miqdor. Mol 10 000 dan va 12 000 dan kelgan bo'lsa, chiqim 11 000 dan yoziladi.",
          "Qoralama harakatlar qoldiqqa ta'sir qilmaydi — faqat o'tkazilganlar.",
        ],
      },
    ],
    faq: [
      ["Qoldiq noto'g'ri chiqyapti.", "Sanoq qiling va farqni «Tuzatish» harakati bilan kiriting: ortiqcha — musbat, kamomad — manfiy miqdor. Qoldiqni qo'lda o'zgartirib bo'lmaydi."],
    ],
  },
  {
    id: "inventory-products",
    part: "Ombor",
    pics: "inventory",
    pages: ["products", "warehouses"],
    title: "Mahsulotlar va omborlar",
    who: "Omborchi va ta'minotchi uchun",
    intro:
      "Mahsulot — omborda hisobga olinadigan narsa: profil, oyna, furnitura, material yoki tayyor deraza-eshik. Har birining ombor birligi bor (m, m2, dona…); yetkazib beruvchi boshqa birlikda sotsa, xarid birligi va koeffitsient yoziladi.",
    to: "/inventory/products",
    blocks: [
      {
        h: "Mahsulotlar ro'yxati",
        shot: {
          img: "products",
          caption: "Ombor → Mahsulotlar",
          marks: [
            "«Mahsulot» — yangi mahsulot qo'shish",
            "Qidiruv: nomi, artikul yoki kod (MH-00001) bo'yicha",
            "Turkum bo'yicha filtr",
            "Qoldiq — barcha omborlardagi jami, ombor birligida",
            "Qatorni bosing — mahsulot kartasi ochiladi",
          ],
        },
        tip: "Ta'minot kirimida (KR) bazada yo'q tovar kelsa, tizim uni shu nom va birlik bilan o'zi yaratadi.",
      },
      {
        h: "Mahsulot kartasi: birliklar",
        shot: {
          img: "product",
          caption: "Mahsulot kartasi (profil)",
          marks: [
            "Turkum: profil, oyna, furnitura, boshqa material, yarim tayyor, tayyor mahsulot",
            "O'lchov birligi — omborda shu birlikda hisoblanadi",
            "Xarid birligi — yetkazib beruvchi qanday sotadi: 1 dona (tayoq) = 6,5 m",
            "Standart tannarx — tuzatish (ortiqcha) uchun, o'rtacha tannarx bo'lmasa",
            "Qoldiq — bosilsa, shu mahsulotning harakatlari ochiladi",
            "Chiqim — shu mahsulot bilan yangi chiqim (tayyor mahsulotda — «Yetkazish»)",
          ],
        },
        points: [
          "Profil 6,5 metrlik tayoq bilan sotilsa: ombor birligi — m, xarid birligi — dona, 1 dona = 6,5 m. Kirimda 10 dona kelsa, omborga 65 m yoziladi.",
          "MRP yetishmayotgan materialni xarid birligida, butun songa yaxlitlab so'raydi (metr emas, tayoq).",
          "Birliklar ro'yxatdan tanlanadi (Sozlamalar → O'lchov birliklari). Bir turdagi birliklar (sm va m) o'zi o'giriladi — koeffitsient shart emas.",
          "Mahsulotning o'tkazilgan harakati bo'lsa, ombor birligini o'zgartirib bo'lmaydi.",
          "Tayyor mahsulot qiymati 2810 hisobida, qolganlari 1010 da yuritiladi. Tayyor va yarim tayyor mahsulotda «Tarkib» (BOM) tugmasi ham chiqadi.",
        ],
        tip: "Harakati bor mahsulotni o'chirib bo'lmaydi — u arxivga o'tadi, harakatlari saqlanadi.",
      },
      {
        h: "Omborlar",
        text: "Ombor → Omborlar. Bitta ombor doim «Asosiy» — ombor tanlanmagan kirim shu yerga tushadi. Hali ombor bo'lmasa, birinchi kirimda «Asosiy ombor» o'zi yaratiladi.",
        shot: {
          img: "warehouses",
          caption: "Ombor → Omborlar",
          marks: ["«Ombor» — yangi ombor qo'shish", "Ombor qatori: «Asosiy» belgisi, manzil, mas'ul, holat", "Tahrirlash"],
        },
      },
      {
        h: "Ombor qo'shish",
        shot: {
          img: "warehouse-dialog",
          caption: "Yangi ombor oynasi",
          marks: [
            "Nomi — masalan, «Sex ombori»",
            "Mas'ul — omborchi (xodimlar ro'yxatidan)",
            "Asosiy ombor — yoqilsa, shu ombor asosiy bo'ladi",
            "Faol — o'chirilsa, ombor yangi harakatlarda tanlanmaydi",
          ],
        },
        points: ["Harakati bor omborni o'chirib bo'lmaydi — uni nofaol qiling."],
      },
    ],
    faq: [
      ["Profilni metrda yuritamizmi yoki tayoqda?", "Omborda metrda (O'lchov birligi — m), xaridda tayoqda (Xarid birligi — dona, 1 dona = 6,5 m). Tizim kirimda o'zi o'giradi."],
      ["Birlikni xato tanladim, o'zgarmayapti.", "Mahsulotda o'tkazilgan harakat bor — birlikni endi o'zgartirib bo'lmaydi. Yangi mahsulot oching, eskisini nofaol qiling."],
    ],
  },
];
