// src/data/quran.ts

export const JUZ_LIST = Array.from({ length: 30 }, (_, i) => i + 1).reverse();

// Format Data: Juz -> Daftar Surat
export const QURAN_DATA: Record<
  number,
  { no: number; nama: string; ayat: number }[]
> = {
  30: [
    { no: 78, nama: "An-Naba'", ayat: 40 },
    { no: 79, nama: "An-Nazi'at", ayat: 46 },
    { no: 80, nama: "'Abasa", ayat: 42 },
    { no: 81, nama: "At-Takwir", ayat: 29 },
    { no: 82, nama: "Al-Infitar", ayat: 19 },
    { no: 83, nama: "Al-Mutaffifin", ayat: 36 },
    { no: 84, nama: "Al-Insyiqaq", ayat: 25 },
    { no: 85, nama: "Al-Buruj", ayat: 22 },
    { no: 86, nama: "At-Tariq", ayat: 17 },
    { no: 87, nama: "Al-A'la", ayat: 19 },
    { no: 88, nama: "Al-Ghasyiyah", ayat: 26 },
    { no: 89, nama: "Al-Fajr", ayat: 30 },
    { no: 90, nama: "Al-Balad", ayat: 20 },
    { no: 91, nama: "Asy-Syams", ayat: 15 },
    { no: 92, nama: "Al-Lail", ayat: 21 },
    { no: 93, nama: "Ad-Duha", ayat: 11 },
    { no: 94, nama: "Al-Insyirah", ayat: 8 },
    { no: 95, nama: "At-Tin", ayat: 8 },
    { no: 96, nama: "Al-'Alaq", ayat: 19 },
    { no: 97, nama: "Al-Qadr", ayat: 5 },
    { no: 98, nama: "Al-Bayyinah", ayat: 8 },
    { no: 99, nama: "Az-Zalzalah", ayat: 8 },
    { no: 100, nama: "Al-'Adiyat", ayat: 11 },
    { no: 101, nama: "Al-Qari'ah", ayat: 11 },
    { no: 102, nama: "At-Takasur", ayat: 8 },
    { no: 103, nama: "Al-'Asr", ayat: 3 },
    { no: 104, nama: "Al-Humazah", ayat: 9 },
    { no: 105, nama: "Al-Fil", ayat: 5 },
    { no: 106, nama: "Quraisy", ayat: 4 },
    { no: 107, nama: "Al-Ma'un", ayat: 7 },
    { no: 108, nama: "Al-Kautsar", ayat: 3 },
    { no: 109, nama: "Al-Kafirun", ayat: 6 },
    { no: 110, nama: "An-Nasr", ayat: 3 },
    { no: 111, nama: "Al-Lahab", ayat: 5 },
    { no: 112, nama: "Al-Ikhlas", ayat: 4 },
    { no: 113, nama: "Al-Falaq", ayat: 5 },
    { no: 114, nama: "An-Nas", ayat: 6 },
  ],

  29: [
    { no: 67, nama: "Al-Mulk", ayat: 30 },
    { no: 68, nama: "Al-Qalam", ayat: 52 },
    { no: 69, nama: "Al-Haqqah", ayat: 52 },
    { no: 70, nama: "Al-Ma'arij", ayat: 44 },
    { no: 71, nama: "Nuh", ayat: 28 },
    { no: 72, nama: "Al-Jinn", ayat: 28 },
    { no: 73, nama: "Al-Muzzammil", ayat: 20 },
    { no: 74, nama: "Al-Muddassir", ayat: 56 },
    { no: 75, nama: "Al-Qiyamah", ayat: 40 },
    { no: 76, nama: "Al-Insan", ayat: 31 },
    { no: 77, nama: "Al-Mursalat", ayat: 50 },
  ],

  28: [
    { no: 58, nama: "Al-Mujadilah", ayat: 22 },
    { no: 59, nama: "Al-Hasyr", ayat: 24 },
    { no: 60, nama: "Al-Mumtahanah", ayat: 13 },
    { no: 61, nama: "As-Saff", ayat: 14 },
    { no: 62, nama: "Al-Jumu'ah", ayat: 11 },
    { no: 63, nama: "Al-Munafiqun", ayat: 11 },
    { no: 64, nama: "At-Taghabun", ayat: 18 },
    { no: 65, nama: "At-Talaq", ayat: 12 },
    { no: 66, nama: "At-Tahrim", ayat: 12 },
  ],

  27: [
    { no: 51, nama: "Adz-Dzariyat", ayat: 60 },
    { no: 52, nama: "At-Tur", ayat: 49 },
    { no: 53, nama: "An-Najm", ayat: 62 },
    { no: 54, nama: "Al-Qamar", ayat: 55 },
    { no: 55, nama: "Ar-Rahman", ayat: 78 },
    { no: 56, nama: "Al-Waqi'ah", ayat: 96 },
    { no: 57, nama: "Al-Hadid", ayat: 29 },
  ],

  26: [
    { no: 46, nama: "Al-Ahqaf", ayat: 35 },
    { no: 47, nama: "Muhammad", ayat: 38 },
    { no: 48, nama: "Al-Fath", ayat: 29 },
    { no: 49, nama: "Al-Hujurat", ayat: 18 },
    { no: 50, nama: "Qaf", ayat: 45 },
  ],

  25: [
    { no: 41, nama: "Fussilat", ayat: 54 },
    { no: 42, nama: "Asy-Syura", ayat: 53 },
    { no: 43, nama: "Az-Zukhruf", ayat: 89 },
    { no: 44, nama: "Ad-Dukhan", ayat: 59 },
    { no: 45, nama: "Al-Jatsiyah", ayat: 37 },
  ],

  24: [
    { no: 39, nama: "Az-Zumar", ayat: 75 },
    { no: 40, nama: "Ghafir", ayat: 85 },
  ],

  23: [
    { no: 36, nama: "Ya-Sin", ayat: 83 },
    { no: 37, nama: "As-Saffat", ayat: 182 },
    { no: 38, nama: "Sad", ayat: 88 },
  ],

  22: [
    { no: 33, nama: "Al-Ahzab", ayat: 73 },
    { no: 34, nama: "Saba'", ayat: 54 },
    { no: 35, nama: "Fatir", ayat: 45 },
  ],

  21: [
    { no: 29, nama: "Al-'Ankabut", ayat: 69 },
    { no: 30, nama: "Ar-Rum", ayat: 60 },
    { no: 31, nama: "Luqman", ayat: 34 },
    { no: 32, nama: "As-Sajdah", ayat: 30 },
  ],

  20: [
    { no: 27, nama: "An-Naml", ayat: 93 },
    { no: 28, nama: "Al-Qasas", ayat: 88 },
  ],

  19: [
    { no: 25, nama: "Al-Furqan", ayat: 77 },
    { no: 26, nama: "Asy-Syu'ara", ayat: 227 },
  ],

  18: [
    { no: 23, nama: "Al-Mu'minun", ayat: 118 },
    { no: 24, nama: "An-Nur", ayat: 64 },
  ],

  17: [
    { no: 21, nama: "Al-Anbiya", ayat: 112 },
    { no: 22, nama: "Al-Hajj", ayat: 78 },
  ],

  16: [
    { no: 18, nama: "Al-Kahf", ayat: 110 },
    { no: 19, nama: "Maryam", ayat: 98 },
    { no: 20, nama: "Ta-Ha", ayat: 135 },
  ],

  15: [{ no: 17, nama: "Al-Isra", ayat: 111 }],

  14: [
    { no: 15, nama: "Al-Hijr", ayat: 99 },
    { no: 16, nama: "An-Nahl", ayat: 128 },
  ],

  13: [
    { no: 12, nama: "Yusuf", ayat: 111 },
    { no: 13, nama: "Ar-Ra'd", ayat: 43 },
    { no: 14, nama: "Ibrahim", ayat: 52 },
  ],

  12: [
    { no: 11, nama: "Hud", ayat: 123 },
    { no: 12, nama: "Yusuf", ayat: 111 },
  ],

  11: [
    { no: 9, nama: "At-Taubah", ayat: 129 },
    { no: 10, nama: "Yunus", ayat: 109 },
    { no: 11, nama: "Hud", ayat: 123 },
  ],

  10: [
    { no: 8, nama: "Al-Anfal", ayat: 75 },
    { no: 9, nama: "At-Taubah", ayat: 129 },
  ],

  9: [
    { no: 7, nama: "Al-A'raf", ayat: 206 },
    { no: 8, nama: "Al-Anfal", ayat: 75 },
  ],

  8: [
    { no: 6, nama: "Al-An'am", ayat: 165 },
    { no: 7, nama: "Al-A'raf", ayat: 206 },
  ],

  7: [
    { no: 5, nama: "Al-Ma'idah", ayat: 120 },
    { no: 6, nama: "Al-An'am", ayat: 165 },
  ],

  6: [
    { no: 4, nama: "An-Nisa'", ayat: 176 },
    { no: 5, nama: "Al-Ma'idah", ayat: 120 },
  ],

  5: [{ no: 4, nama: "An-Nisa'", ayat: 176 }],

  4: [
    { no: 3, nama: "Ali 'Imran", ayat: 200 },
    { no: 4, nama: "An-Nisa'", ayat: 176 },
  ],

  3: [
    { no: 2, nama: "Al-Baqarah", ayat: 286 },
    { no: 3, nama: "Ali 'Imran", ayat: 200 },
  ],

  2: [{ no: 2, nama: "Al-Baqarah", ayat: 286 }],

  1: [
    { no: 1, nama: "Al-Fatihah", ayat: 7 },
    { no: 2, nama: "Al-Baqarah", ayat: 286 },
  ],
};
