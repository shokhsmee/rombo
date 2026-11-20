// Qo'llanma → Mijozlar: the clients list and the client card. Pictures: backend/scripts/guide/clients.py
import type { GuideSection } from "../types";

export const CHAPTERS: GuideSection[] = [
  {
    id: "clients-list",
    part: "Savdo",
    pics: "clients",
    pages: ["clients"],
    title: "Mijozlar",
    who: "Sotuv menejeri uchun",
    intro:
      "Mijoz — buyurtma beruvchi: jismoniy shaxs, tashkilot yoki diler. Har bir Loyiha bitta mijozga bog'lanadi; mijoz kartasida uning barcha loyihalari va to'lovlari ko'rinadi.",
    to: "/clients",
    blocks: [
      {
        h: "Mijozlar ro'yxati",
        text: "Chap menyuda Savdo → Mijozlar.",
        shot: {
          img: "list",
          caption: "Savdo → Mijozlar",
          marks: [
            "«Yangi mijoz» — bo'sh karta ochiladi",
            "Turi bo'yicha filtr: jismoniy, yuridik, diler / hamkor yoki yetkazib beruvchi",
            "Hudud bo'yicha filtr",
            "Mas'ul menejer bo'yicha filtr — nomini yozib tanlang",
            "Holat: faol yoki nofaol mijozlar",
            "Mijoz: nomi, ostida — turi, segmenti va STIR",
          ],
        },
        points: [
          "Qidiruv: kod (MJ-…), nom, STIR, aloqa shaxsi, telefon yoki hudud bo'yicha. Telefonning bir qismini yozish kifoya (masalan, 901112233).",
          "Yetkazib beruvchilar bu ro'yxatda faqat «Yetkazib beruvchi» filtri tanlanganda chiqadi — ular Ta'minot → Yetkazib beruvchilar bo'limida yuritiladi.",
          "Guruh amallari: «Nofaol qilish», «Faol qilish», «Arxivlash». Excel orqali mijozlarni yuklab olish va fayldan kiritish mumkin («Ro'yxatlar bilan ishlash» bobiga qarang).",
        ],
      },
      {
        h: "Yangi mijoz qo'shish",
        steps: [
          "«Yangi mijoz» tugmasini bosing.",
          "Turini tanlang: «Jismoniy shaxs», «Yuridik shaxs» yoki «Diler / hamkor».",
          "F.I.O. (yoki tashkilot nomi) — majburiy, kamida 2 ta harf.",
          "Telefon, hudud va mas'ul menejerni kiriting.",
          "«Saqlash» ni bosing — mijozga kod beriladi (MJ-00001 kabi).",
        ],
        tip: "Mijozni Loyiha ochayotganda ham yaratish mumkin — «Loyiha: yangi buyurtma» bobidagi «Mijozni shu yerda yaratish» ga qarang.",
      },
    ],
    faq: [
      ["«STIR» xatosi chiqyapti.", "STIR 9 dan 14 tagacha raqam bo'lishi kerak. Shu STIR bilan faol mijoz allaqachon bo'lsa, ikkinchisini saqlab bo'lmaydi — mavjud mijozni qidirib toping."],
      ["Mijoz ro'yxatda yo'q.", "Filtrlarni tekshiring — ayniqsa «Holat» (nofaol mijozlar) va «Turi». Arxivlangan mijoz ro'yxatda ko'rinmaydi."],
    ],
  },
  {
    id: "client-card",
    part: "Savdo",
    pics: "clients",
    pages: ["clients"],
    title: "Mijoz kartasi",
    who: "Sotuv menejeri uchun",
    intro:
      "Kartada mijozning hamma ma'lumoti: turi, aloqa, manzil va xaritadagi joyi, pasport yoki bank rekvizitlari. Pastda — uning loyihalari, o'ngda — tarix (kim nimani o'zgartirgan, qo'ng'iroqlar, izohlar).",
    to: "/clients",
    blocks: [
      {
        h: "Asosiy ma'lumotlar",
        shot: {
          img: "card",
          caption: "Jismoniy shaxs kartasi",
          marks: [
            "Turi: Jismoniy shaxs, Yuridik shaxs, Diler / hamkor yoki Yetkazib beruvchi — tanlovga qarab maydonlar o'zgaradi",
            "F.I.O. — majburiy",
            "STIR — jismoniy shaxsga ixtiyoriy",
            "Mas'ul menejer — mijoz bilan ishlaydigan xodim (faqat ishlayotgan xodimlar tanlanadi)",
            "Segment — VIP, Standart, Ekonom va h.k. Ro'yxat Sozlamalar → Ma'lumotnomalar da yuritiladi; mijozning loyihalarida ham ko'rinadi",
            "«Loyihalar» — mijozning loyihalari soni; bosilsa, ular ro'yxati ochiladi",
            "«To'lovlar» — kassadagi shu mijoz bo'yicha kirim va chiqim orderlari",
            "Pasport — shartnomaga chop etiladi (faqat jismoniy shaxsda)",
          ],
        },
        points: [
          "«Aloqa» bo'limi: asosiy va qo'shimcha telefon, email, «Qayerdan kelgan» (tavsiya, Instagram, ko'rgazma…).",
          "Shartnoma chop etilganda mijozning F.I.O., pasporti, manzili va telefoni olinadi — Loyiha tasdiqlanishidan oldin to'ldiring.",
          "«Faol mijoz» o'chirilsa — mijoz nofaol bo'ladi, ma'lumotlari saqlanadi.",
        ],
      },
      {
        h: "Xaritadagi joyi (lokatsiya)",
        text: "Mijozning obyekti qayerdaligini belgilab qo'ying — zamerchik va o'rnatuvchilar uchun. Belgilangan mijozlar CRM → Mijozlar xaritasi da ko'rinadi.",
        shot: {
          img: "location",
          caption: "Manzil → Lokatsiya",
          marks: [
            "Koordinatalar: «39.6542, 66.9597» yoki Google / Yandex / OpenStreetMap havolasini shu yerga qo'ying",
            "Xarita: kerakli joyni bosing yoki pinni suring",
            "«Xaritada ochish» — joyni brauzerda xaritada ochish (yo'l topish uchun)",
            "Lokatsiyani olib tashlash",
          ],
        },
        points: [
          "Qisqa havola (masalan, maps.app.goo.gl/…) tushunilmaydi: uni brauzerda oching va manzil qatoridagi to'liq havolani qo'ying.",
          "Pin ko'chirilsa, tarixga eski va yangi koordinata yoziladi.",
        ],
      },
      {
        h: "Tashkilot va diler",
        text: "«Yuridik shaxs» yoki «Diler / hamkor» tanlansa, karta tashkilot uchun o'zgaradi.",
        shot: {
          img: "company",
          caption: "Diler kartasi",
          marks: [
            "Turi — «Diler / hamkor»",
            "Tashkilot nomi — majburiy",
            "Aloqa shaxsi — tashkilotda kim bilan gaplashiladi",
            "Bank rekvizitlari: hisob raqami, bank va MFO",
          ],
        },
        points: [
          "Yuridik shaxs uchun STIR — 9 ta raqam.",
          "«Diler / hamkor» turidagi mijozlar Loyihadagi «Hamkor» maydonida tanlanadi.",
        ],
      },
      {
        h: "Mijozning loyihalari",
        shot: {
          img: "projects",
          caption: "Mijoz kartasining pastki qismi",
          marks: [
            "Loyihalar va ularning soni",
            "Loyiha: kodi, nomi, topshirish muddati va summasi — bosilsa, Loyiha ochiladi",
            "Loyihaning hozirgi bosqichi",
          ],
        },
        points: [
          "Oxirgi 6 ta loyiha ko'rsatiladi; ko'proq bo'lsa — «Barchasi →» havolasi chiqadi.",
          "Mijozning qarzi va to'lovlari har bir Loyihaning «Moliya» bo'limida va «To'lovlar» tugmasida.",
        ],
      },
    ],
    faq: [
      ["Mijozni o'chira olmayapman.", "Mijozda loyiha bo'lsa, uni o'chirib bo'lmaydi — «Faol mijoz» ni o'chirib, nofaol qiling."],
      ["Mijozga qo'ng'iroq qilingan edi, qayerda ko'rinadi?", "Mijoz raqami bilan bo'lgan qo'ng'iroq tugagach, u mijoz kartasining «Tarix» ida yoziladi."],
    ],
  },
];
