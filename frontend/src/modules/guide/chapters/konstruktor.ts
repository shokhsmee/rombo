// Qo'llanma → Chizmalar (Konstruktor): drawing a Loyiha's windows and doors, the price, the calculation and the
// cut plan. Pictures: backend/scripts/guide/konstruktor.py
import type { GuideSection } from "../types";

export const CHAPTERS: GuideSection[] = [
  {
    id: "konstruktor",
    part: "Savdo",
    pics: "konstruktor",
    pages: ["constructions"],
    title: "Chizmalar — Konstruktor",
    who: "Sotuv menejeri va zamerchik uchun",
    intro:
      "Konstruktorda Loyihaning har bir derazasi, eshigi va balkon bloki brauzerda chiziladi. Tizim chizmadan profil kesimlarini, oyna o'lchamlarini, rezina metrini va furnitura sonini o'zi hisoblaydi, narxni ko'rsatadi va hisob-kitobni to'ldiradi. Qo'lda 15–40 ta son yozish shart emas.",
    blocks: [
      {
        h: "Loyihadagi chizmalar",
        text: "Loyiha kartasida «Chizmalar — Konstruktor» bo'limi bor. Bu yerda Loyihaning barcha konstruksiyalari kichik rasm bo'lib turadi.",
        shot: {
          img: "panel",
          caption: "Loyiha kartasi → Chizmalar — Konstruktor",
          marks: [
            "«Yangi konstruksiya» — yangi deraza yoki eshik chizish",
            "Konstruksiya kartasi: nomi, kodi (KS-…), o'lchami, m². Bosilsa — tahrirlash; burchakdagi «…» — nusxa olish yoki o'chirish",
            "«Hisob-kitobga o'tkazish» — chizmadagi hamma material sonini hisob-kitobga yozadi",
            "«Raskroy» — profillarni xlistlarga qanday kesish kerakligi",
            "Jami: dona, m² va taxminiy narx",
          ],
        },
        points: [
          "Konstruksiya qo'shilganda Loyihaning «Buyurtma turi» jadvali (m² va soni) chizmalardan o'zi to'ladi.",
          "«Xaridda» bosqichidan boshlab chizmalar qulflanadi — tugmalar ko'rinmaydi.",
        ],
      },
      {
        h: "1-qadam: shablon tanlash",
        shot: {
          img: "templates",
          caption: "Yangi konstruksiya → Shablon tanlang",
          marks: [
            "Gluxoy — ochilmaydigan oyna",
            "Uch qism — o'rtasi qo'zg'almas, chetlari ochiladigan deraza",
            "Balkon bloki — eshik va deraza birga",
            "Eshik",
          ],
        },
        text: "Eng yaqin shaklni tanlang — keyin o'lcham, kataklar va ochilishni o'zgartirasiz. Shablonni keyin ham «Shablon» tugmasi bilan almashtirish mumkin.",
      },
      {
        h: "2-qadam: o'lcham va soni",
        shot: {
          img: "editor",
          caption: "Konstruktor",
          marks: [
            "Eni — tashqi o'lcham, mm (300 dan 6000 gacha)",
            "Bo'yi — tashqi o'lcham, mm",
            "Soni — shunday konstruksiyadan nechta (masalan, 5 ta bir xil deraza — bitta chizma, soni 5)",
            "Chizma: o'lchamlar va ochilish belgilari rasmda; katak raqamlari burchakda",
            "Shablon — boshqa shaklga almashtirish",
            "Maydon va taxminiy narx — har o'zgarishda darrov yangilanadi",
          ],
        },
        tip: "Xato qilsangiz — Ctrl+Z (orqaga) va Ctrl+Y (qaytarish). Saqlamaguningizcha hech narsa yozilmaydi.",
      },
      {
        h: "3-qadam: katakni sozlash",
        text: "Chizmadagi katakni bosing — o'ng tomonda shu katak sozlamalari ochiladi.",
        shot: {
          img: "cell",
          caption: "Katak tanlangan",
          marks: [
            "Chizma: tanlangan katak ko'k ramka bilan",
            "Ochilishi: qo'zg'almas, burilma, burilma-qiyalama, fortochka yoki eshik",
            "Lup tomoni — tabaqa qaysi tomonga ochiladi (chap / o'ng)",
            "To'ldirish: oyna, panel yoki lambri; pastda — oyna turi (narx ro'yxatidan)",
            "Bo'lish: 2, 3 yoki 4 qismga — ustunlarga (vertikal impost) yoki qatorlarga (gorizontal impost)",
          ],
        },
        points: [
          "«Qo'shni kataklar bilan birlashtirish» — impostni olib tashlab, ikki katakni bittaga qaytaradi.",
          "Har katak kamida 150 mm bo'lishi kerak — juda kichik bo'lsa, tizim ogohlantiradi.",
        ],
      },
      {
        h: "4-qadam: qismlar o'lchami (impost)",
        text: "Kataklar orasidagi chiziq — impost. Uni bosing va qismlarning aniq o'lchamini yozing.",
        shot: {
          img: "impost",
          caption: "Impost tanlangan",
          marks: [
            "Tanlangan impost — ko'k",
            "Har ustun (yoki qator) o'lchami, mm: bittasini o'zgartirsangiz, qo'shnisi moslashadi. «Teng bo'lish» — barchasi teng",
          ],
        },
      },
      {
        h: "5-qadam: hisobni tekshirish va saqlash",
        shot: {
          img: "result",
          caption: "Hisob va konstruksiya ma'lumotlari",
          marks: [
            "Narx — har material: soni va summasi (narx ro'yxatidan)",
            "Detallar — profil kesimlari: qaysi profil, uzunligi mm, nechta",
            "Oynalar — har oynaning o'lchami va m² (oyna buyurtmasi uchun)",
            "Konstruksiya: nomi («Mehmonxona derazasi»), profil tizimi, buyurtma turi, izoh",
          ],
        },
        steps: [
          "Konstruksiyaga tushunarli nom bering — mijoz va sex shu nom bilan taniydi.",
          "Profil tizimini tekshiring (masalan, «Rombo Termo 65»): narx va kesim qoidalari shundan olinadi.",
          "Yuqoridagi «Saqlash» ni bosing. Saqlangach «Nusxa» (bir xil konstruksiyadan yana bitta) va «O'chirish» chiqadi.",
        ],
        tip: "Sariq yozuv «sex tomonidan hali tasdiqlanmagan» — profil tizimi qiymatlarini sex hali tekshirmagan. Kesish uzunliklarini sex bilan solishtirib turing.",
      },
      {
        h: "6-qadam: hisob-kitobga o'tkazish",
        text: "Barcha konstruksiyalar chizilgach, Loyiha kartasida «Hisob-kitobga o'tkazish» ni bosing. Tizim hisob-kitobni ochadi va chizmadan olingan sonlarni yozadi.",
        shot: {
          img: "calc-drawing",
          caption: "Chizmadan to'ldirilgan hisob-kitob",
          marks: [
            "Chizmadan olingan qator",
            "«chizmadan» belgisi — bu son konstruksiyalardan hisoblangan",
            "Tarixda: «Hisob-kitob chizmadan to'ldirildi» — nechta qator o'zgargani bilan",
          ],
        },
        points: [
          "Qo'lda yozilgan qatorlar (masalan, transport, montaj) saqlanib qoladi — faqat «chizmadan» qatorlari yangilanadi.",
          "Chizmani o'zgartirsangiz, «Hisob-kitobga o'tkazish» ni yana bosing.",
          "Loyiha summasi hisob-kitobdan o'zi olinadi; MRP Loyihaga aniq materiallarni chizmadan oladi.",
        ],
      },
      {
        h: "Raskroy: profil kesish xaritasi",
        text: "Loyihaning barcha konstruksiyalari birga kesiladi — xlist kamroq ketadi. Bu sahifa sex uchun: qaysi xlistdan qaysi bo'laklar kesiladi.",
        shot: {
          img: "cut-plan",
          caption: "Loyiha → Raskroy",
          marks: [
            "Chop etish — sexga qog'ozda berish",
            "Xlistlar — jami nechta 6,5 metrlik xlist kerak",
            "Bitta xlist: har bo'lak uzunligi mm bilan, kesish tartibida",
            "Qoldiq — xlist oxirida qoladigan bo'lak",
            "Profil bo'yicha jami: xlist soni, detallar uzunligi va chiqindi foizi",
          ],
        },
        points: [
          "Har kesimga arra qalinligi (5 mm) qo'shiladi.",
          "Bitta deraza uchun chiqindi katta ko'rinadi — Loyihada konstruksiya ko'p bo'lsa, foiz kamayadi.",
        ],
      },
      {
        h: "Profil tizimi (sozlamalar)",
        text: "Konstruktor qanday hisoblashi profil tizimida yoziladi: profil enlari, zaxiralar, oyna ayirmalari va narx ro'yxatiga bog'lanish. Buni rahbar yoki texnolog bir marta sozlaydi: Sozlamalar → Profil tizimlari.",
        shot: {
          img: "system",
          caption: "Sozlamalar → Profil tizimlari → Rombo Termo 65",
          marks: [
            "Narx ro'yxati — material narxlari shu ro'yxatdan olinadi",
            "«Sex hali tasdiqlamagan» — yoqilgan bo'lsa, konstruktorda sariq ogohlantirish chiqadi",
            "Xlist uzunligi (6500 mm)",
            "Arra qalinligi — har kesimga qo'shiladi",
            "O'lchamlar sxemasi — har qiymat rasmda qayerda ekanini ko'rsatadi",
          ],
        },
        tip: "Loyiha tasdiqlanganda uning konstruksiyalari hisobi «muzlatiladi»: keyin profil tizimi o'zgarsa ham, tasdiqlangan loyihaning kesimlari o'zgarmaydi.",
      },
    ],
    faq: [
      ["«Yangi konstruksiya» tugmasi yo'q.", "Loyiha «Xaridda» yoki undan keyingi bosqichda — chizmalar qulflangan. Yoki sizda konstruksiya yaratish ruxsati yo'q."],
      ["Narx «…» bo'lib turibdi yoki ba'zi detallar narxsiz.", "Profil tizimida bu material narx ro'yxatiga bog'lanmagan. Ogohlantirishda nomi yoziladi — Sozlamalar → Profil tizimlari da bog'lang."],
      ["Bir xil 10 ta deraza bor — 10 marta chizamanmi?", "Yo'q. Bitta chizing va «Soni» ga 10 yozing. Biroz farqli bo'lsa — «Nusxa» bilan ko'paytirib, o'lchamini o'zgartiring."],
      ["Profil xlistdan uzun degan xato chiqdi.", "Konstruksiyaning bir tomoni 6,5 metrdan uzun — bitta profildan kesib bo'lmaydi. Konstruksiyani ikkiga bo'ling."],
    ],
    to: "/projects",
  },
];
