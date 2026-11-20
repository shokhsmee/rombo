// Qo'llanma → Servis: servis arizasi (SV-…) qabul qilishdan yopishgacha, ustalar, mijoz va usta botlari.
// Pictures: backend/scripts/guide/service.py
import type { GuideSection } from "../types";

export const CHAPTERS: GuideSection[] = [
  {
    id: "service-requests",
    part: "Servis",
    pics: "service",
    pages: ["service_requests"],
    title: "Servis arizasi: qabul qilishdan yopishgacha",
    who: "Servis operatori uchun",
    intro:
      "Servis arizasi — o'rnatilgandan keyingi murojaat: deraza yopilmayapti, tutqich singan, oyna yorilgan, maskitka yirtilgan. Ariza yo'li: Yangi → Ustaga berildi → Usta qabul qildi → Bajarilmoqda → Bajarildi → Yopildi. Har bir o'zgarish tarixga yoziladi.",
    to: "/service",
    blocks: [
      {
        h: "Arizalar ro'yxati",
        text: "Chap menyuda Servis → Arizalar.",
        shot: {
          img: "list",
          caption: "Servis → Arizalar",
          marks: [
            "«Yangi ariza» — telefon orqali kelgan murojaatni yozish",
            "«Ochiq» — hali yopilmagan barcha arizalar (yonida soni)",
            "Holat bo'yicha filtr: Yangi, Ustaga berildi, Usta qabul qildi… — yonida soni",
            "Qidiruv: kod, mijoz, telefon, manzil, usta. Yonida — turi, usta, mijoz va manba bo'yicha filtr",
            "«Kafolat» — faqat kafolat bo'yicha arizalar",
            "Qator: kod, qachon va qayerdan kelgan (Telegram bot, Telefon, ERP), mijoz, muammo, usta, baho, holat",
          ],
        },
        points: [
          "Mijoz Telegram bot orqali ariza qoldirsa, u shu ro'yxatda «Yangi» bo'lib paydo bo'ladi.",
          "Yashil qalqon belgisi — ariza kafolat bo'yicha. Yulduzlar — mijoz bahosi.",
          "Ro'yxat ustidagi kulrang yozuv bot sozlanmaganini bildiradi — unda botlar ishlamaydi, arizalar faqat ERP orqali yuritiladi.",
        ],
      },
      {
        h: "Yangi ariza",
        shot: {
          img: "new",
          caption: "Yangi ariza formasi",
          marks: [
            "Mijoz — majburiy. Tanlansa, telefon va lokatsiya mijoz kartasidan olinadi",
            "Loyiha — shu mijozning buyurtmalaridan. Tanlansa, ariza kafolat bo'yicha deb belgilanadi",
            "Lokatsiya — «kenglik, uzunlik» (41.311, 69.279). Yonidagi belgi xaritada ochadi",
            "Muammo turi: Rostlash, Furnitura, Oyna / paket, Maskitka, Germetik, Qayta o'rnatish, Boshqa",
            "Kafolat bo'yicha yoki Pullik",
            "Tavsif — majburiy: nima bo'lganini mijoz so'zi bilan yozing",
            "Saqlash — arizaga kod beriladi (SV-26-00001) va u «Yangi» holatida ochiladi",
          ],
        },
        points: [
          "Telefon va manzil bo'sh qolsa — mijoz telefoni va loyiha (yoki mijoz) manzili olinadi.",
          "«Qulay sana» — mijozga qachon kelish qulay. «Narx» — pullik ish bo'lsa.",
          "Rasmlarni ariza saqlangandan keyin yuklang.",
        ],
      },
      {
        h: "Ustaga berish",
        text: "Yangi arizaning asosiy tugmasi — «Ustaga berish».",
        shot: {
          img: "card",
          caption: "«Yangi» ariza",
          marks: [
            "«Ustaga berish» — ustani va kelish vaqtini tanlash",
            "«Boshqa» — qolgan amallar (bekor qilish)",
            "Holatlar chizig'i: hozirgi holat ko'k",
            "Usta — biriktirilgan usta (bosilsa, usta kartasi)",
            "«Telegram · mijoz botda» — holat o'zgarsa, mijozga botda xabar boradi",
          ],
        },
      },
      {
        h: "Usta va kelish vaqti",
        shot: {
          img: "assign",
          caption: "«Ustaga berish» oynasi",
          marks: [
            "Usta — faqat faol ustalar; har birining yonida ochiq ishlari soni",
            "Kelish vaqti — sana va soat (ixtiyoriy). Pastda mijozga qulay sana ko'rsatiladi",
            "Usta botga ulangan bo'lsa, ish unga darhol yuboriladi",
            "«Berish» — ariza «Ustaga berildi» holatiga o'tadi",
          ],
        },
        tip: "Ish boshlanguncha ustani almashtirish mumkin: tugma «Ustani o'zgartirish» bo'lib qoladi.",
      },
      {
        h: "Holatni o'zgartirish",
        text: "Odatda holatni usta botda o'zi o'zgartiradi: qabul qiladi, ishni boshlaydi, tugatadi. Usta botda bo'lmasa yoki telefonda aytsa — operator ERP'da tugmalar bilan o'zgartiradi.",
        shot: {
          img: "status-more",
          caption: "«Usta qabul qildi» holatidagi ariza",
          marks: [
            "Asosiy tugma — keyingi qadam (bu yerda «Ishni boshlash»)",
            "Ustani o'zgartirish",
            "«Boshqa»: «Ustadan olish» — ariza yana «Yangi» bo'ladi; «Bekor qilish»",
          ],
        },
        steps: [
          "Ustaga berildi → «Usta qabul qildi»: usta ishni oldi. Usta rad etsa yoki «Ustadan olish» bosilsa — ariza «Yangi» ga qaytadi.",
          "Usta qabul qildi → «Ishni boshlash»: usta joyida, ish boshlandi.",
          "Bajarilmoqda → «Bajarildi»: ish tugadi.",
          "Bajarildi → «Yopish»: mijoz rozi, ariza yopiladi. Mijoz «tuzalmadi» desa — «Qayta ochish» (yana «Bajarilmoqda»).",
        ],
        tip: "Qadamdan sakrab bo'lmaydi: masalan, «Yangi» arizani to'g'ri «Bajarildi» qilib bo'lmaydi. Faqat ruxsat etilgan qadamlar tugma bo'lib chiqadi.",
      },
      {
        h: "Usta, vaqt va rasmlar",
        shot: {
          img: "accepted",
          caption: "Ariza kartasining pastki qismi",
          marks: [
            "Kelish vaqti — ustaga berishda belgilangan",
            "Bosqichlar: yaratildi, ustaga berildi, boshlandi, bajarildi, yopildi — sana va soat",
            "Muammo rasmlari — mijoz botda yuborgan yoki operator yuklagan",
            "Bajarilgan ish rasmlari — usta ish tugagach yuboradi",
          ],
        },
        points: [
          "«Rasm qo'shish» — bir nechta rasmni birdan yuklash. Rasmni bossangiz, yangi oynada katta ochiladi.",
          "O'ng tomondagi «Tarix» — har bir holat, usta va vaqt o'zgarishi, kim qilgani.",
        ],
      },
      {
        h: "Bekor qilish",
        shot: {
          img: "cancel",
          caption: "Boshqa → Bekor qilish",
          marks: [
            "Sabab tarixga yoziladi; mijoz botda bo'lsa, unga ham yuboriladi",
            "Sabab — majburiy",
            "«Bekor qilish» — tasdiqlash",
          ],
        },
        points: [
          "Bekor qilingan arizani qayta ochib bo'lmaydi — kerak bo'lsa, yangi ariza oching.",
          "Ish tugagach («Bajarildi» dan keyin) bekor qilib bo'lmaydi.",
          "«Yangi» arizani o'chirish ham mumkin (o'chirish ruxsati bo'lsa).",
        ],
      },
      {
        h: "Natija va baho",
        shot: {
          img: "closed",
          caption: "Yopilgan ariza",
          marks: [
            "Yopilgan va bekor qilingan arizani o'zgartirib bo'lmaydi",
            "Usta hisoboti — usta ish tugaganda yozgan izoh",
            "Mijoz bahosi — 1 dan 5 gacha yulduz (mijoz botda qo'yadi)",
            "Mijoz fikri",
          ],
        },
      },
    ],
    faq: [
      ["«Ustaga berish» tugmasi yo'q.", "Ariza «Bajarilmoqda» yoki undan keyingi holatda — endi ustani almashtirib bo'lmaydi. Yoki sizda arizani tahrirlash ruxsati yo'q."],
      ["Usta ro'yxatda chiqmayapti.", "Usta nofaol. Servis → Ustalar → usta kartasida «Faol» ni yoqing."],
      ["Mijozga xabar bormadi.", "Mijoz botga ulanmagan («Telegram · mijoz botda» belgisi yo'q) yoki bot sozlanmagan. Unda mijozga telefon qiling."],
    ],
  },
  {
    id: "service-masters",
    part: "Servis",
    pics: "service",
    pages: ["service_masters"],
    title: "Ustalar va Telegram botlar",
    who: "Servis operatori va rahbar uchun",
    intro:
      "Usta — servis ishlarini bajaradigan odam (shtatdagi yoki tashqi). Ustalar va mijozlar Rombo'ga kirmaydi: ular Telegram botlar va ulardagi ilova (Mini App) orqali ishlaydi. ERP'da operator ustalar ro'yxatini yuritadi.",
    to: "/service/masters",
    blocks: [
      {
        h: "Ustalar ro'yxati",
        text: "Chap menyuda Servis → Ustalar.",
        shot: {
          img: "masters",
          caption: "Servis → Ustalar",
          marks: [
            "«Yangi usta» — ustani qo'shish",
            "Barchasi / Faol / Nofaol",
            "Telegram — usta botga ulanganmi («Ulangan», botni bloklagan bo'lsa «Bloklagan»)",
            "Ochiq ishlar — hozir ustada turgan arizalar",
            "Baho — mijozlar bahosining o'rtachasi",
          ],
        },
      },
      {
        h: "Usta kartasi",
        shot: {
          img: "master",
          caption: "Usta kartasi",
          marks: [
            "Ochiq ishlar — bosilsa, shu ustaning ochiq arizalari ro'yxati",
            "Bajarilgan ishlar soni (yonida — o'rtacha baho)",
            "Telefon — majburiy va takrorlanmas. Usta botga aynan shu raqamni yuborishi kerak",
            "Ixtisoslik — nimani yaxshi qiladi: furnitura, oyna paket…",
            "Faol: «Ish beriladi» / «Ish berilmaydi»",
            "Telegram — usta botda telefonini yuborganda o'zi ulanadi",
          ],
        },
        points: [
          "Ustani yangi qo'shganda F.I.O. va telefon yetarli; kod (US-0001) o'zi beriladi.",
          "«Xodim» — usta shtatda bo'lsa, xodim kartasiga bog'lang.",
          "Ochiq ishi bor ustani nofaol qilib bo'lmaydi — avval arizalarini boshqa ustaga bering.",
          "Arizasi bo'lgan ustani o'chirish o'rniga nofaol qiling.",
        ],
      },
      {
        h: "Mijoz boti",
        points: [
          "Mijoz botni ochib /start bosadi va tugma orqali telefon raqamini yuboradi. Bot uni shu raqamli mijozga bog'laydi; bunday mijoz bo'lmasa — yangi mijoz yaratiladi.",
          "«Ariza qoldirish» — ilovada muammo turi, tavsif, rasmlar, manzil va lokatsiya bilan ariza yuboradi. ERP'da ariza «Telegram bot» manbasi bilan paydo bo'ladi.",
          "Ilovada mijoz o'z arizalari holatini kuzatadi, ish boshlanmagan arizani bekor qila oladi.",
          "Mijozga botda xabar boradi: ariza qabul qilindi, usta biriktirildi (ismi, telefoni, vaqti), ish boshlandi, ish bajarildi, ariza bekor qilindi.",
          "Ish bajarilgach bot 1 dan 5 gacha baho so'raydi. Mijoz ishdan norozi bo'lsa, izoh bilan arizani qayta ochadi.",
        ],
      },
      {
        h: "Usta boti",
        points: [
          "Usta botni ochib telefon raqamini yuboradi. Raqam faol ustalar ro'yxatida bo'lsa — ulanadi; bo'lmasa bot rad etadi va hech narsa yaratmaydi. Shuning uchun avval ustani ERP'da shu raqam bilan qo'shing.",
          "Ustaga yangi ish «✅ Qabul qilish» va «❌ Rad etish» tugmalari bilan keladi. Rad etsa — ariza «Yangi» ga qaytadi va ofisga xabar beriladi.",
          "Ilovada usta bugungi va faol ishlarini ko'radi: mijoz telefoni, xarita, ishni boshlash va hisobot hamda rasmlar bilan tugatish.",
          "Ish undan olinsa, mijoz qayta ochsa yoki baho qo'ysa — ustaga ham xabar boradi.",
        ],
        tip: "Botlar ishlashi uchun serverda ularning tokenlari sozlangan bo'lishi kerak. Sozlanmagan bo'lsa, «Arizalar» sahifasida kulrang ogohlantirish chiqadi — administratorga ayting.",
      },
    ],
    faq: [
      ["Usta botga raqam yubordi, lekin ulanmadi.", "Ustalar ro'yxatida shu raqamli faol usta yo'q yoki raqam boshqacha yozilgan. Usta kartasidagi telefonni tekshiring."],
      ["Mijoz boshqa birovning kontaktini yubordi.", "Bot faqat yuboruvchining o'z raqamini qabul qiladi va qayta so'raydi."],
    ],
  },
];
