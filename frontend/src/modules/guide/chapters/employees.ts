// Qo'llanma → Xodimlar: the staff list and the employee card. Pictures: backend/scripts/guide/employees.py
import type { GuideSection } from "../types";

export const CHAPTERS: GuideSection[] = [
  {
    id: "employees",
    part: "Xodimlar",
    pics: "employees",
    pages: ["employees"],
    title: "Xodimlar",
    who: "Kadrlar bo'limi va rahbar uchun",
    intro:
      "Har bir xodimning kartasi: F.I.O., aloqa, bo'lim, lavozim, ishga kirgan sana va holati. Xodim mijoz va Loyihalarda mas'ul menejer bo'lib tanlanadi; tizimga kiradigan bo'lsa, unga login bog'lanadi.",
    to: "/employees",
    blocks: [
      {
        h: "Xodimlar ro'yxati",
        text: "Chap menyuda Xodimlar.",
        shot: {
          img: "list",
          caption: "Xodimlar",
          marks: [
            "«Yangi xodim» — bo'sh karta ochiladi",
            "Qidiruv: kod (XD-…), familiya, ism, telefon, lavozim yoki bo'lim bo'yicha",
            "Holat bo'yicha filtr: ishlamoqda, ta'tilda, bo'shagan",
            "Bo'lim bo'yicha filtr",
            "Xodim: F.I.O. va kodi — bosilsa, karta ochiladi",
            "Login — xodim qaysi foydalanuvchi nomi bilan tizimga kiradi («—» — logini yo'q)",
          ],
        },
        points: [
          "Guruh amallari: «Holatini o'zgartirish» (bir nechta xodimni birdan, masalan, ta'tilga) va «O'chirish».",
          "Excel: ro'yxatni yuklab olish va fayldan kiritish. Faylda Familiya va Ism majburiy, sanalar 31.10.2026 ko'rinishida.",
        ],
      },
      {
        h: "Xodim kartasi",
        shot: {
          img: "card",
          caption: "Xodim kartasi",
          marks: [
            "Holat: «Ishlamoqda», «Ta'tilda» yoki «Bo'shagan» — bosing va «Saqlash» ni bosing",
            "Familiya — majburiy",
            "Ism — majburiy",
            "Bo'lim — yozing yoki avval kiritilgan bo'limlardan tanlang",
            "Lavozim",
            "Ishga kirgan sana",
            "Tizim logini — xodimning foydalanuvchi hisobi (Foydalanuvchilar ruxsati borlarga ko'rinadi)",
          ],
        },
        steps: [
          "«Yangi xodim» ni bosing.",
          "Familiya va ismni yozing; otasining ismi, tug'ilgan sana, telefon va email — ixtiyoriy.",
          "«Ish joyi» bo'limida bo'lim, lavozim va ishga kirgan sanani kiriting.",
          "«Saqlash» ni bosing — xodimga kod beriladi (XD-0001 kabi).",
        ],
        points: [
          "Bitta login faqat bitta xodimga bog'lanadi. Boshqa xodimga bog'langan loginni tanlasangiz, saqlanmaydi.",
          "Mijoz kartasidagi «Mas'ul menejer» ro'yxatida faqat «Ishlamoqda» holatidagi xodimlar chiqadi.",
          "Xodimning o'zi tizimga kirishi uchun avval Sozlamalar → Foydalanuvchilar da login yarating, keyin shu yerda bog'lang.",
        ],
        tip: "Ishdan ketgan xodimni o'chirmang — holatini «Bo'shagan» qiling. Shunda u bilan bog'liq mijoz va loyihalarda ismi saqlanib qoladi.",
      },
    ],
    faq: [
      ["Xodimni o'chirsam nima bo'ladi?", "Xodim arxivga o'tadi va ro'yxatda ko'rinmaydi. Unga bog'langan login bo'shaydi — uni boshqa xodimga bog'lash mumkin."],
      ["«Tizim logini» maydoni ko'rinmayapti.", "Bu maydon faqat Foydalanuvchilar sahifasiga ruxsati borlarga chiqadi."],
    ],
  },
];
