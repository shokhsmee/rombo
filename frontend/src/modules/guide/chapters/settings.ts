// Qo'llanma → Sozlamalar: users and roles, pick lists, prices, approval steps. Pictures: backend/scripts/guide/settings.py
import type { GuideSection } from "../types";

export const CHAPTERS: GuideSection[] = [
  {
    id: "settings-users",
    part: "Sozlamalar",
    pics: "settings",
    pages: ["users", "roles"],
    title: "Foydalanuvchilar va rollar",
    who: "Administrator uchun",
    intro:
      "Har bir xodim tizimga o'z logini bilan kiradi. U nimani ko'rishi va qila olishini rollar belgilaydi: rol — har bir sahifa uchun ko'rish, yaratish, tahrirlash va o'chirish ruxsati.",
    to: "/settings/users",
    blocks: [
      {
        h: "Sozlamalar sahifasi",
        text: "Chap menyuda pastdagi «Sozlamalar». Kamdan-kam o'zgaradigan narsalar shu yerda kartochka bo'lib turadi; har kim faqat o'ziga ruxsat berilganlarini ko'radi.",
        shot: {
          img: "home",
          caption: "Sozlamalar",
          marks: [
            "Menyudagi «Sozlamalar»",
            "Foydalanuvchilar — tizimga kiradigan hisoblar",
            "Rollar va ruxsatlar — kim nimani qila oladi",
            "Tizim: Claude ulanish, Spetsifikatsiyalar, Takliflar",
          ],
        },
      },
      {
        h: "Foydalanuvchilar ro'yxati",
        shot: {
          img: "users",
          caption: "Sozlamalar → Foydalanuvchilar",
          marks: [
            "«Yangi foydalanuvchi»",
            "Rol bo'yicha filtr",
            "Faol yoki bloklanganlar",
            "Foydalanuvchining rollari (rol berilmagan bo'lsa — sariq «Rol berilmagan»)",
            "Holat: Faol yoki Bloklangan",
          ],
        },
        tip: "Bir nechta foydalanuvchini belgilab, pastdagi panel orqali birdan bloklash yoki faollashtirish mumkin.",
      },
      {
        h: "Yangi foydalanuvchi",
        shot: {
          img: "user-new",
          caption: "Yangi foydalanuvchi formasi",
          marks: [
            "Login — kamida 3 ta belgi, bo'sh joysiz",
            "Parol — kamida 8 ta belgi; foydalanuvchiga o'zingiz aytasiz",
            "Rollar — bir nechtasini belgilash mumkin, ruxsatlar qo'shiladi",
            "Sahifalarga kirish — belgilangan rollar bo'yicha u nimani ko'rishi, saqlashdan oldin",
            "«Saqlash»",
          ],
        },
        steps: [
          "Foydalanuvchilar → «Yangi foydalanuvchi».",
          "Ism (majburiy), familiya, login va parolni yozing.",
          "Rollarni belgilang. Pastdagi jadvalda u ko'radigan sahifalar darhol ko'rinadi.",
          "«Saqlash» ni bosing va login-parolni xodimga bering.",
        ],
        tip: "Rol berilmagan foydalanuvchi tizimga kiradi, lekin hech qaysi sahifani ko'rmaydi.",
      },
      {
        h: "Bloklash va parolni tiklash",
        shot: {
          img: "user",
          caption: "Foydalanuvchi kartochkasi",
          marks: [
            "«Faol» — o'chirib saqlansa, foydalanuvchi bloklanadi",
            "Rollar",
            "«Parolni tiklash» — yangi parol berish",
            "Sahifalarga kirish — rollaridan hisoblangan ruxsatlar",
          ],
        },
        points: [
          "Foydalanuvchini o'chirib bo'lmaydi — u hujjatlar tarixida qoladi. Ishdan ketgan xodimni bloklang.",
          "Bloklash va parolni tiklash foydalanuvchini darhol barcha qurilmalardan chiqaradi; uning Claude tokenlari ham ishlamay qoladi.",
          "O'zingizni bloklay olmaysiz va o'zingizdan Superuser huquqini ola olmaysiz.",
          "Superuser — barcha sahifalarga to'liq ruxsat, rollar hisobga olinmaydi. Superuser berish, superuserni tahrirlash, bloklash yoki parolini tiklash faqat superuserga mumkin.",
        ],
      },
      {
        h: "Rollar",
        shot: {
          img: "roles",
          caption: "Sozlamalar → Rollar va ruxsatlar",
          marks: [
            "«Yangi rol»",
            "«tizim» — tayyor rollar; ularni o'chirib bo'lmaydi, lekin ruxsatlarini o'zgartirsa bo'ladi",
            "Qatorni bosing — rol ochiladi; o'ngda — shu roldagi foydalanuvchilar soni",
          ],
        },
      },
      {
        h: "Ruxsatlar jadvali",
        text: "Rol kartochkasida har bir sahifa — bitta qator, har bir amal — bitta ustun.",
        shot: {
          img: "role",
          caption: "Rol → Sahifalarga ruxsat",
          marks: [
            "Amallar: ko'rish, yaratish, tahrirlash, o'chirish; «Hammasi» — qatorni birdan yoqish",
            "Bo'lim nomi (menyudagi guruh)",
            "Chiziqcha — qatorning bir qismi yoqilgan",
            "Nuqta — bu sahifada bunday amal yo'q",
          ],
        },
        points: [
          "Yaratish, tahrirlash yoki o'chirish belgilansa, ko'rish o'zi yoqiladi. Ko'rishni olib tashlasangiz, butun qator tozalanadi.",
          "Foydalanuvchida bir nechta rol bo'lsa, ruxsatlari qo'shiladi.",
          "O'zgarish saqlangach shu roldagi barcha foydalanuvchilarga darhol ta'sir qiladi.",
          "«tez orada» belgisi — hali qurilmagan sahifa; ruxsatni oldindan tayyorlab qo'yish mumkin.",
          "Ruxsatni server ham tekshiradi: tugma ko'rinmasa ham, ruxsatsiz amal bajarilmaydi.",
        ],
        tip: "Rolni o'chirsangiz, u barcha foydalanuvchilardan olib tashlanadi.",
      },
    ],
    faq: [
      ["Xodim parolini unutdi.", "Foydalanuvchi kartochkasi → «Parolni tiklash» → yangi parol (kamida 8 ta belgi). U barcha qurilmalardan chiqariladi va yangi parol bilan kiradi."],
      ["Xodim tizimga kirdi, lekin menyu bo'sh.", "Unga rol berilmagan yoki rolda hech qaysi sahifani ko'rish ruxsati yo'q. Foydalanuvchi kartochkasida «Sahifalarga kirish» jadvalini tekshiring."],
    ],
  },
  {
    id: "settings-lists",
    part: "Sozlamalar",
    pics: "settings",
    pages: ["references", "pricing", "approval_steps"],
    title: "Ma'lumotnomalar, narxlar va tasdiqlash",
    who: "Administrator va rahbar uchun",
    intro:
      "Kartochkalardagi tanlov ro'yxatlari, hisob-kitob narxlari va xarid so'rovini kim tasdiqlashi — barchasi Sozlamalarda.",
    to: "/settings",
    blocks: [
      {
        h: "Ma'lumotnomalar",
        text: "Loyiha va mijoz kartochkasidagi tanlov ro'yxatlari: buyurtma turi, sotuv kanali, brend, mijoz segmenti, hamda o'lchov birliklari. Ro'yxatlarni hamma o'qiydi; o'zgartirish uchun Ma'lumotnomalar ruxsati kerak.",
        shot: {
          img: "references",
          caption: "Sozlamalar → Ma'lumotnomalar",
          marks: [
            "Ro'yxatni tanlang",
            "Ro'yxat nomi va u qayerda ishlatilishi",
            "Faol / nofaol — nofaol qiymat yangi yozuvlarda tanlovga chiqmaydi, eskilarida qoladi",
            "Nomini o'zgartirish",
            "O'chirish — faqat hech qaerda ishlatilmagan qiymat",
            "Yangi qiymat yozing va «Qo'shish»",
          ],
        },
        points: [
          "Bir ro'yxatda bir xil nom ikki marta bo'lmaydi.",
          "Ishlatilgan qiymatni o'chirib bo'lmaydi — nofaol qiling.",
          "O'lchov birliklari: nomi, turkumi (dona, uzunlik, yuza…), asosiy birlikka nisbati va boshqa yozilishlari (шт, ta). Mahsulotda ishlatilgan birlikning nomi, turkumi va nisbatini o'zgartirib bo'lmaydi.",
        ],
      },
      {
        h: "Narxlar",
        text: "Narx ro'yxati — bitta seriya uchun komplektlovchilar va narxlar. Loyihada «Hisob-kitob qo'shish» bosilganda narx ro'yxatining barcha faol qatorlari bugungi narxda ko'chiriladi.",
        shot: {
          img: "pricing",
          caption: "Sozlamalar → Narxlar",
          marks: ["«Yangi narx ro'yxati»", "Narx ro'yxati: nomi, buyurtma turi, profil uzunligi, valyuta", "Qatorlar soni"],
        },
      },
      {
        h: "Narx ro'yxatini tahrirlash",
        shot: {
          img: "pricelist",
          caption: "Narx ro'yxati",
          marks: [
            "Nomi — takrorlanmaydi",
            "Buyurtma turi (Ma'lumotnomalardan)",
            "Valyuta: USD yoki so'm",
            "Faol — nofaol ro'yxat yangi hisob-kitobga tanlanmaydi",
            "Narx — 0 yoki undan katta",
            "Qatorni yuqoriga / pastga surish yoki o'chirish",
          ],
        },
        points: [
          "«Qator qo'shish» — jadval ostida. Har qatorda nom, birlik va narx bo'lishi shart.",
          "Narxni o'zgartirish eski hisob-kitoblarga ta'sir qilmaydi — ular yaratilgan kundagi narxda qoladi. Loyihadagi hisob-kitobda «Narxlarni yangilash» bosilsa, yangi narx olinadi.",
          "Narx ro'yxatini o'chirsangiz ham, mavjud hisob-kitoblar o'z narxlarini saqlab qoladi.",
        ],
      },
      {
        h: "Tasdiqlash bosqichlari",
        text: "Xarid so'rovi yuborilgach, faol bosqichlardan tartib bo'yicha o'tadi: har bir bosqichni shu rolning faol a'zosi (yoki superuser) tasdiqlaydi.",
        shot: {
          img: "approval",
          caption: "Sozlamalar → Tasdiqlash bosqichlari",
          marks: ["«Bosqich qo'shish»", "1-bosqich: Ta'minot boshlig'i", "2-bosqich: Direktor", "Tahrirlash — tartib, nom, rol, faollik"],
        },
        points: [
          "Birorta bosqich rad etsa, so'rov rad etiladi; qayta ochilganda tasdiq yana birinchi bosqichdan boshlanadi.",
          "Faol bosqich bo'lmasa — «So'rovlarni tasdiqlash» ruxsati bor har kim so'rovni bir marta tasdiqlaydi.",
          "Har bir qaror (kim, qachon, izoh) so'rov tarixida saqlanadi.",
        ],
      },
      {
        h: "Bosqich qo'shish",
        shot: {
          img: "approval-step",
          caption: "Yangi bosqich",
          marks: ["Tartib — kichigi oldin (10, 20, 30…)", "Kim tasdiqlaydi — rol", "Faol"],
        },
        tip: "Kutayotgan so'rov bo'lsa, bosqichni o'chirmang — nofaol qiling.",
      },
    ],
    faq: [
      ["Loyiha kartochkasida kerakli brend yo'q.", "Ma'lumotnomalar → Brend → yangi qiymat qo'shing. Agar u bor, lekin nofaol bo'lsa — yoqing."],
    ],
  },
];
