// Qo'llanma → Loyihalar: the order from a draft to closing. Pictures: backend/scripts/guide/projects.py
import type { GuideSection } from "../types";

export const CHAPTERS: GuideSection[] = [
  {
    id: "project-new",
    part: "Savdo",
    pics: "projects",
    pages: ["projects"],
    title: "Loyiha: yangi buyurtma",
    who: "Sotuv menejeri uchun",
    intro:
      "Loyiha — bitta mijoz buyurtmasi. Xarid, ishlab chiqarish, ombor, to'lov va hisob-faktura — hammasi shu Loyihaga bog'lanadi. Har bir buyurtma Loyiha ochishdan boshlanadi.",
    to: "/projects",
    blocks: [
      {
        h: "Loyihalar ro'yxati",
        text: "Chap menyuda Savdo → Loyihalar. Bu yerda barcha buyurtmalar: kim buyurtma bergan, qachon topshiriladi, qancha qarz qolgan.",
        shot: {
          img: "list",
          caption: "Savdo → Loyihalar",
          marks: [
            "«Yangi loyiha» — istalgan sahifadan yangi buyurtma ochish",
            "Bosqich bo'yicha filtr: yonidagi raqam — shu bosqichdagi loyihalar soni",
            "Qidiruv: kod, nom, mijoz yoki telefon bo'yicha (bir nechta so'z — hammasi mos kelishi kerak)",
            "«Muddati o'tgan» — topshirish sanasi o'tib ketgan loyihalar (qizil sana)",
            "Excel: ro'yxatni yuklab olish yoki Excel'dan kiritish",
            "Qatorni bosing — Loyiha kartasi ochiladi",
          ],
        },
        points: [
          "«Qarz» ustuni qizil bo'lsa — mijoz hali to'liq to'lamagan.",
          "Chap tomondagi belgilash katakchalari — bir nechta loyihani birdan eksport qilish uchun.",
        ],
      },
      {
        h: "Yangi loyiha ochish",
        shot: {
          img: "new",
          caption: "Yangi loyiha formasi",
          marks: [
            "Loyiha nomi — qisqa va tushunarli: «Xususiy uy — derazalar va eshiklar»",
            "Mijoz — ro'yxatdan tanlang yoki shu yerning o'zida yarating (pastda)",
            "Topshirish muddati — shu sanadan o'tsa, loyiha «muddati o'tgan» bo'ladi",
            "Buyurtma turi: Termo, PVX, Alyumin… — har qatorga kvadratura (m²) va soni",
            "Saqlash — loyihaga kod beriladi (LY-26-00001) va u «Qoralama» bosqichida ochiladi",
          ],
        },
        steps: [
          "Yuqoridagi «Yangi loyiha» tugmasini bosing.",
          "Loyiha nomi va mijozni kiriting (ikkalasi majburiy, * bilan belgilangan).",
          "Sotuvchi, hamkor (diler) va sotuv kanalini tanlang — keyin hisobotlarda kerak bo'ladi.",
          "«Buyurtma turi» jadvalida har bir mahsulot turi uchun m² va sonini yozing. «Qator qo'shish» — yana bir tur.",
          "Profil rangi, oyna, aksessuarlar, podokonnik — shartnomaga shu yozuvlar tushadi.",
          "«Saqlash» ni bosing.",
        ],
        tip: "Summa hozircha qo'lda yoziladi. Hisob-kitob qo'shilgach, summa o'zi hisob-kitobdan olinadi.",
      },
      {
        h: "Mijozni shu yerda yaratish",
        text: "Mijoz hali bazada yo'q bo'lsa, Loyihadan chiqmasdan uni qo'shish mumkin.",
        shot: {
          img: "client-create",
          caption: "Mijoz maydoniga yangi ism yozilganda",
          marks: [
            "Mijoz ismini yozing — topilmasa, ikki tanlov chiqadi",
            "«…» yaratish — shu ism bilan jismoniy shaxs darhol yaratiladi va tanlanadi",
            "«Yaratish va to'ldirish…» — telefon, viloyat, manzil va STIR bilan to'liq forma ochiladi",
          ],
        },
        tip: "Bu tanlovlar faqat mijoz yaratish ruxsati borlarga chiqadi.",
      },
    ],
    faq: [
      ["Loyihani o'chirsa bo'ladimi?", "Faqat «Qoralama» bosqichidagini. Tasdiqlangan loyihani o'chirib bo'lmaydi — uni «Bekor qilish» kerak (sabab bilan)."],
      ["Kod qayerdan olinadi?", "Saqlanganda tizim o'zi beradi: LY-yil-tartib raqami. Kodni o'zgartirib bo'lmaydi."],
    ],
  },
  {
    id: "project-stages",
    part: "Savdo",
    pics: "projects",
    pages: ["projects"],
    title: "Loyiha bosqichlari",
    who: "Sotuv menejeri va rahbar uchun",
    intro:
      "Loyiha yetti bosqichdan o'tadi: Qoralama → Tasdiqlangan → Xaridda → Ishlab chiqarishda → Tayyor → Yetkazildi → Yopildi. Bosqich tugma bilan o'zgaradi; har bir o'zgarish tarixga yoziladi.",
    to: "/projects",
    blocks: [
      {
        h: "Loyiha kartasi",
        shot: {
          img: "card",
          caption: "Tasdiqlangan loyiha kartasi",
          marks: [
            "Asosiy tugma — keyingi bosqichga o'tkazish (bu yerda «Xaridga o'tkazish»)",
            "«Boshqa» — boshqa yo'llar: to'g'ridan-to'g'ri ishlab chiqarishga, orqaga qaytarish, bekor qilish",
            "Bosqichlar chizig'i: ko'k — hozirgi bosqich, och ko'k — o'tilganlar",
            "Mijoz — bosilsa, mijoz kartasi ochiladi",
            "Qarz — buyurtma + xizmat − avans (qizil — qarz bor, yashil — to'langan)",
            "Hujjatlar — shartnoma va hisob-kitobni chop etish",
          ],
        },
        points: [
          "Yuqoridagi kichik tugmalar (Xaridlar, Hisob-fakturalar, To'lovlar, Ombor harakatlari) — shu loyihaga tegishli hujjatlar ro'yxatini ochadi.",
          "O'ng tomondagi «Tarix» — kim, qachon, nimani o'zgartirgani.",
        ],
      },
      {
        h: "Bosqichdan bosqichga",
        shot: {
          img: "status-more",
          caption: "«Boshqa» menyusi",
          marks: [
            "Odatiy yo'l — bitta tugma",
            "Qolgan imkoniyatlar: xaridsiz ishlab chiqarishga, bekor qilish (qizil), qoralamaga qaytarish",
          ],
        },
        steps: [
          "Qoralama → «Tasdiqlash»: mijoz rozi bo'ldi, shartnoma tuzildi.",
          "Tasdiqlangan → «Xaridga o'tkazish»: material sotib olish kerak. Ta'minot loyihaning materiallari bo'yicha buyurtma yuborganda tizim o'zi ham shu bosqichga o'tkazadi.",
          "Xaridda → «Ishlab chiqarishga»: material keldi, sex ishni boshladi. Material omborda bo'lsa, Tasdiqlangandan to'g'ridan-to'g'ri ham o'tkazish mumkin.",
          "Ishlab chiqarishda → «Tayyor»: mahsulot tayyor (sexdan omborga qabul qilish — «Ishlab chiqarish» bobida).",
          "Tayyor → «Yetkazildi»: mijozga topshirildi.",
          "Yetkazildi → «Yopish»: hisob-kitob tugadi. Yopilgan loyihani boshqa o'zgartirib bo'lmaydi.",
        ],
        tip: "Bosqichdan sakrab o'tib bo'lmaydi (masalan, Qoralamadan to'g'ri «Tayyor» ga). Faqat ruxsat etilgan qadamlar tugma bo'lib chiqadi.",
      },
      {
        h: "Xaridda va undan keyin: qulf",
        text: "Material sotib olina boshlagach, buyurtma tarkibini o'zgartirish xavfli — sexga noto'g'ri narsa ketadi. Shuning uchun «Xaridda» bosqichidan boshlab mahsulot ma'lumotlari qulflanadi.",
        shot: {
          img: "locked",
          caption: "Xaridda bo'lgan loyiha",
          marks: [
            "Loyiha «Xaridda» bosqichida",
            "Ogohlantirish: mahsulot ma'lumotlari qulflangan",
          ],
        },
        points: [
          "Qulflanadi: mijoz, loyiha nomi, buyurtma turlari, brend, mahsulot nomi, maskitka, demontaj, hisob-kitob va chizmalar.",
          "O'zgartirsa bo'ladi: summalar, avans, telefon, sanalar, lokatsiya, hamkor, izoh — pul va muddat ish davomida o'zgaradi.",
        ],
      },
      {
        h: "Bekor qilish",
        shot: {
          img: "cancel",
          caption: "Boshqa → Bekor qilish",
          marks: ["Sabab — majburiy, tarixga yoziladi", "Tasdiqlash"],
        },
        points: [
          "Bekor qilingan loyihani keyin «Qoralamaga qaytarish» mumkin.",
          "«Ishlab chiqarishda» va undan keyingi bosqichlarda bekor qilib bo'lmaydi.",
        ],
      },
      {
        h: "Tarix va izohlar",
        shot: {
          img: "history",
          caption: "Loyiha kartasining o'ng tomoni",
          marks: [
            "Izoh qoldiring — hamkasblar uchun eslatma (mijoz bilan gaplashuv, kelishuv)",
            "Filtr: hammasi / faqat izohlar / faqat o'zgarishlar",
            "O'zgarish yozuvi: eski qiymat ustidan chizilgan → yangi qiymat",
          ],
        },
      },
    ],
    faq: [
      ["Loyihani xato bosqichga o'tkazib yubordim.", "Tasdiqlangan loyihani «Boshqa → Qoralamaga qaytarish» bilan qaytaring. Xaridda va undan keyingi bosqichlardan orqaga yo'l yo'q — rahbarga murojaat qiling."],
      ["Nega «Xaridga o'tkazish» tugmasi yo'q?", "Sizda Loyihani tahrirlash ruxsati yo'q yoki loyiha boshqa bosqichda. Ruxsatlar: Sozlamalar → Rollar va ruxsatlar."],
    ],
  },
  {
    id: "project-money",
    part: "Savdo",
    pics: "projects",
    pages: ["projects"],
    title: "Loyiha: hisob-kitob, pul va hujjatlar",
    who: "Sotuv menejeri va kassir uchun",
    intro:
      "Loyihaning narxi hisob-kitobdan (narx ro'yxati bo'yicha material sanog'i) chiqadi. Avans va qarz kassaga tushgan to'lovlardan hisoblanadi; shartnoma va hisob-kitob shu ma'lumotlardan chop etiladi.",
    to: "/projects",
    blocks: [
      {
        h: "Hisob-kitob qo'shish",
        shot: {
          img: "calcs",
          caption: "Loyiha kartasi → Hisob-kitob bo'limi",
          marks: [
            "Varaqa: narx ro'yxati nomi, sana va jami summa — bosilsa ochiladi",
            "Chop etish — sotuv varaqasi ko'rinishida",
            "«Hisob-kitob qo'shish» — narx ro'yxatini tanlang, uning barcha qatorlari bugungi narxda ko'chiriladi",
          ],
        },
        tip: "Chizmalar (Konstruktor) bo'lsa, hisob-kitobni qo'lda to'ldirish shart emas — «Hisob-kitobga o'tkazish» uni o'zi to'ldiradi. «Chizmalar — Konstruktor» bobiga qarang.",
      },
      {
        h: "Hisob-kitob varaqasi",
        shot: {
          img: "calc",
          caption: "Hisob-kitob",
          marks: [
            "Narxlarni yangilash — narx ro'yxatidagi yangi narxlarni qayta o'qish (o'zi o'zgarmaydi)",
            "Chop etish",
            "Faqat to'ldirilganlar — soni 0 bo'lgan qatorlarni yashirish",
            "Soni — shu yerga yozasiz; summa = soni × narx, butun songa yaxlitlanadi",
            "Jami va so'mdagi qiymati (Loyihadagi USD kursi bo'yicha)",
          ],
        },
        points: [
          "Narxni ham shu yerda o'zgartirsa bo'ladi — faqat shu loyiha uchun.",
          "Loyihaning summasi hisob-kitoblar jamidan o'zi olinadi. Valyuta har xil bo'lsa — Loyihadagi «USD kursi» bilan o'giriladi; kurs yo'q bo'lsa, summa o'zgarmaydi va ogohlantirish chiqadi.",
        ],
      },
      {
        h: "Moliya: avans, qarz, to'lov",
        shot: {
          img: "money",
          caption: "Loyiha kartasi → Moliya",
          marks: [
            "Buyurtma summasi va valyutasi (so'm yoki USD)",
            "Avans — kassada to'lov o'tkazilgach, o'zi hisoblanadi; to'lov bo'lmasa, qo'lda yoziladi",
            "Qarz = buyurtma + xizmat − avans",
            "Buxgalteriya: hisob-faktura, to'langan va qoldiq — buxgalteriya yozuvlaridan",
            "To'lov qo'shish — kassada kirim orderi mijoz, loyiha va qarz summasi bilan tayyor ochiladi",
            "Hisob-faktura chiqarish — loyiha bo'yicha hisob-faktura qoralamasi",
          ],
        },
        tip: "USD kursi 1 000 dan 50 000 gacha bo'lishi kerak — ortiqcha nol yozilsa (119 990), tizim qabul qilmaydi.",
      },
      {
        h: "Shartnoma va hisob-kitobni chop etish",
        shot: {
          img: "documents",
          caption: "Hujjatlar menyusi",
          marks: [
            "Shartnoma — kompaniya namunasi, loyiha, mijoz (pasport, manzil, telefon) va rekvizitlar bilan to'ldiriladi",
            "Hisob-kitob — sotuv varaqasi: qatorlar, jami, avans, qoldiq, muddat",
          ],
        },
        points: ["Shartnoma uchun mijozning pasporti va manzili, kompaniya rekvizitlari (Sozlamalar → Kompaniya) to'ldirilgan bo'lsin."],
      },
    ],
    faq: [
      ["Avansni o'zgartira olmayapman.", "Loyihaga kassadan to'lov tushgan — endi avans to'lovlardan o'zi hisoblanadi. Tuzatish kerak bo'lsa, kassadagi orderni tekshiring."],
      ["Narx ro'yxatida narx o'zgardi, hisob-kitobim eski narxda.", "Bu to'g'ri: hisob-kitob yaratilgan kundagi narxni saqlaydi. Yangilash uchun «Narxlarni yangilash» ni bosing."],
    ],
  },
];
