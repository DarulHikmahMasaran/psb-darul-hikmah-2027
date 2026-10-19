import {
  Subject,
  QuestionCategory,
  Question,
  QuestionOption,
  Exam,
  ExamQuestionConfig
} from '../types/cbt';

export const defaultSubjects: Subject[] = [
  {
    id: 'sub-mtk',
    code: 'MATEMATIKA',
    name: 'Matematika Dasar',
    description: 'Operasi hitung bilangan bulat, pecahan, FPB & KPK, geometri dasar, dan perbandingan.',
    is_active: true,
    sort_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'sub-bind',
    code: 'BAHASA_INDONESIA',
    name: 'Bahasa Indonesia',
    description: 'Pemahaman teks, ide pokok paragraf, kosakata, ejaan EYD, dan kalimat efektif.',
    is_active: true,
    sort_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'sub-ipa',
    code: 'IPA',
    name: 'Ilmu Pengetahuan Alam (IPA)',
    description: 'Biologi dasar, sistem organ, ekosistem lingkungan, energi gerak, dan tata surya.',
    is_active: true,
    sort_order: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'sub-pai',
    code: 'PAI',
    name: 'Pendidikan Agama Islam (PAI)',
    description: 'Aqidah akhlak, fiqih ibadah shalat & thaharah, sejarah nabi & rasul, dan dasar Al-Qur\'an.',
    is_active: true,
    sort_order: 4,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'sub-umum',
    code: 'PENGETAHUAN_UMUM',
    name: 'Pengetahuan Umum & Keislaman',
    description: 'Wawasan kebangsaan, sejarah peradaban Islam nusantara, budaya pesantren, dan logika.',
    is_active: true,
    sort_order: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const defaultCategories: QuestionCategory[] = [
  { id: 'cat-mtk-1', subject_id: 'sub-mtk', name: 'Aritmatika & Pecahan', description: 'Operasi hitung campuran bilangan bulat dan pecahan', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'cat-mtk-2', subject_id: 'sub-mtk', name: 'Geometri & Pengukuran', description: 'Bangun datar, ruang, keliling dan volume', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'cat-bind-1', subject_id: 'sub-bind', name: 'Pemahaman Bacaan', description: 'Ide pokok, simpulan, dan makna tersirat paragraf', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'cat-bind-2', subject_id: 'sub-bind', name: 'Tata Bahasa & Ejaan', description: 'PUEBI, kalimat efektif, imbuhan, dan sinonim', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'cat-ipa-1', subject_id: 'sub-ipa', name: 'Makhluk Hidup & Lingkungan', description: 'Rantai makanan, adaptasi, dan organ tubuh', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'cat-ipa-2', subject_id: 'sub-ipa', name: 'Fisika Dasar & Energi', description: 'Gaya, kalor, perubahan wujud, dan magnet', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'cat-pai-1', subject_id: 'sub-pai', name: 'Fiqih Ibadah', description: 'Wudhu, shalat fardhu & sunnah, serta puasa', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'cat-pai-2', subject_id: 'sub-pai', name: 'Aqidah & Tarikh', description: 'Rukun iman, sifat wajib Allah, dan sirah nabawiyah', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'cat-umum-1', subject_id: 'sub-umum', name: 'Wawasan Kebangsaan', description: 'Pancasila, UUD 1945, dan sejarah Indonesia', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'cat-umum-2', subject_id: 'sub-umum', name: 'Kepesantrenan & Logika', description: 'Tradisi santri dan tes penalaran logis', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

export const defaultQuestions: Question[] = [
  // 1. MATEMATIKA
  {
    id: 'q-mtk-1',
    subject_id: 'sub-mtk',
    category_id: 'cat-mtk-1',
    question_text: 'Hasil dari 3/4 + 1/2 - 2/3 adalah ...',
    question_type: 'MULTIPLE_CHOICE',
    explanation: 'Samakan penyebut ke 12: 9/12 + 6/12 - 8/12 = 7/12.',
    difficulty: 'SEDANG',
    points: 4,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    options: [
      { id: 'opt-mtk-1a', question_id: 'q-mtk-1', option_key: 'A', option_text: '5/12', is_correct: false, sort_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-mtk-1b', question_id: 'q-mtk-1', option_key: 'B', option_text: '7/12', is_correct: true, sort_order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-mtk-1c', question_id: 'q-mtk-1', option_key: 'C', option_text: '9/12', is_correct: false, sort_order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-mtk-1d', question_id: 'q-mtk-1', option_key: 'D', option_text: '11/12', is_correct: false, sort_order: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]
  },
  {
    id: 'q-mtk-2',
    subject_id: 'sub-mtk',
    category_id: 'cat-mtk-1',
    question_text: 'KPK (Kelipatan Persekutuan Terkecil) dari bilangan 24 dan 36 adalah ...',
    question_type: 'MULTIPLE_CHOICE',
    explanation: '24 = 2^3 x 3, 36 = 2^2 x 3^2. KPK = 2^3 x 3^2 = 8 x 9 = 72.',
    difficulty: 'MUDAH',
    points: 4,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    options: [
      { id: 'opt-mtk-2a', question_id: 'q-mtk-2', option_key: 'A', option_text: '48', is_correct: false, sort_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-mtk-2b', question_id: 'q-mtk-2', option_key: 'B', option_text: '72', is_correct: true, sort_order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-mtk-2c', question_id: 'q-mtk-2', option_key: 'C', option_text: '96', is_correct: false, sort_order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-mtk-2d', question_id: 'q-mtk-2', option_key: 'D', option_text: '144', is_correct: false, sort_order: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]
  },
  {
    id: 'q-mtk-3',
    subject_id: 'sub-mtk',
    category_id: 'cat-mtk-2',
    question_text: 'Sebuah lapangan berbentuk persegi panjang memiliki panjang 25 meter dan lebar 16 meter. Luas lapangan tersebut adalah ...',
    question_type: 'MULTIPLE_CHOICE',
    explanation: 'Luas = panjang x lebar = 25 x 16 = 400 m2.',
    difficulty: 'MUDAH',
    points: 4,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    options: [
      { id: 'opt-mtk-3a', question_id: 'q-mtk-3', option_key: 'A', option_text: '350 m²', is_correct: false, sort_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-mtk-3b', question_id: 'q-mtk-3', option_key: 'B', option_text: '400 m²', is_correct: true, sort_order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-mtk-3c', question_id: 'q-mtk-3', option_key: 'C', option_text: '425 m²', is_correct: false, sort_order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-mtk-3d', question_id: 'q-mtk-3', option_key: 'D', option_text: '450 m²', is_correct: false, sort_order: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]
  },
  {
    id: 'q-mtk-4',
    subject_id: 'sub-mtk',
    category_id: 'cat-mtk-2',
    question_text: 'Apakah segitiga sama sisi memiliki 3 sumbu simetri lipat?',
    question_type: 'TRUE_FALSE',
    explanation: 'Segitiga sama sisi memiliki 3 sisi yang sama panjang dan 3 sudut 60 derajat, sehingga memiliki 3 sumbu simetri.',
    difficulty: 'MUDAH',
    points: 4,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    options: [
      { id: 'opt-mtk-4a', question_id: 'q-mtk-4', option_key: 'BENAR', option_text: 'Benar', is_correct: true, sort_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-mtk-4b', question_id: 'q-mtk-4', option_key: 'SALAH', option_text: 'Salah', is_correct: false, sort_order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]
  },

  // 2. BAHASA INDONESIA
  {
    id: 'q-bind-1',
    subject_id: 'sub-bind',
    category_id: 'cat-bind-1',
    question_text: 'Perhatikan paragraf berikut:\n"Pondok Pesantren Tahfidzul Qur\'an Modern Darul Hikmah membimbing para santri untuk mencintai Al-Qur\'an sejak dini. Selain menghafal kalam ilahi dengan tajwid yang sahih, santri juga dibekali ilmu pengetahuan umum serta adab budi pekerti yang mulia."\n\nIde pokok paragraf di atas adalah ...',
    question_type: 'MULTIPLE_CHOICE',
    explanation: 'Gagasan utama paragraf terletak di awal kalimat mengenai bimbingan santri mencintai Al-Qur\'an dan berakhlak mulia di PPTQM Darul Hikmah.',
    difficulty: 'SEDANG',
    points: 4,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    options: [
      { id: 'opt-bind-1a', question_id: 'q-bind-1', option_key: 'A', option_text: 'Pembekalan ilmu umum santri pesantren', is_correct: false, sort_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-bind-1b', question_id: 'q-bind-1', option_key: 'B', option_text: 'Bimbingan mencintai Al-Qur\'an dan akhlak di PPTQM Darul Hikmah', is_correct: true, sort_order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-bind-1c', question_id: 'q-bind-1', option_key: 'C', option_text: 'Kaidah menghafal dengan ilmu tajwid sahih', is_correct: false, sort_order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-bind-1d', question_id: 'q-bind-1', option_key: 'D', option_text: 'Syarat kelulusan santri jenjang sekolah menengah', is_correct: false, sort_order: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]
  },
  {
    id: 'q-bind-2',
    subject_id: 'sub-bind',
    category_id: 'cat-bind-2',
    question_text: 'Penulisan kata baku yang benar menurut Kamus Besar Bahasa Indonesia (KBBI) adalah ...',
    question_type: 'MULTIPLE_CHOICE',
    explanation: 'Kata baku yang tepat adalah "Ijazah", "Apotek", dan "Praktik".',
    difficulty: 'MUDAH',
    points: 4,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    options: [
      { id: 'opt-bind-2a', question_id: 'q-bind-2', option_key: 'A', option_text: 'Ijasah, Apotik, Praktek', is_correct: false, sort_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-bind-2b', question_id: 'q-bind-2', option_key: 'B', option_text: 'Ijazah, Apotek, Praktik', is_correct: true, sort_order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-bind-2c', question_id: 'q-bind-2', option_key: 'C', option_text: 'Ijasah, Apotek, Praktek', is_correct: false, sort_order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-bind-2d', question_id: 'q-bind-2', option_key: 'D', option_text: 'Ijazah, Apotik, Praktik', is_correct: false, sort_order: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]
  },
  {
    id: 'q-bind-3',
    subject_id: 'sub-bind',
    category_id: 'cat-bind-2',
    question_text: 'Antonim (lawan kata) dari kata "KHAUF" dalam konteks akhlak adalah "ROJA\'" (berharap). Apakah kata "IKHLAS" berlawanan makna dengan "RIYA\'"?',
    question_type: 'TRUE_FALSE',
    explanation: 'Ikhlas beramal murni karena Allah berlawanan makna secara langsung dengan riya\' (beramal ingin dipuji manusia).',
    difficulty: 'MUDAH',
    points: 4,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    options: [
      { id: 'opt-bind-3a', question_id: 'q-bind-3', option_key: 'BENAR', option_text: 'Benar', is_correct: true, sort_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-bind-3b', question_id: 'q-bind-3', option_key: 'SALAH', option_text: 'Salah', is_correct: false, sort_order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]
  },

  // 3. IPA
  {
    id: 'q-ipa-1',
    subject_id: 'sub-ipa',
    category_id: 'cat-ipa-1',
    question_text: 'Proses tumbuhan hijau mengolah zat hara dan air menjadi glukosa dengan bantuan sinar matahari klorofil disebut ...',
    question_type: 'MULTIPLE_CHOICE',
    explanation: 'Fotosintesis merupakan pembentukan glukosa/energi pada klorofil daun oleh energi cahaya.',
    difficulty: 'MUDAH',
    points: 4,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    options: [
      { id: 'opt-ipa-1a', question_id: 'q-ipa-1', option_key: 'A', option_text: 'Respirasi', is_correct: false, sort_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-ipa-1b', question_id: 'q-ipa-1', option_key: 'B', option_text: 'Transpirasi', is_correct: false, sort_order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-ipa-1c', question_id: 'q-ipa-1', option_key: 'C', option_text: 'Fotosintesis', is_correct: true, sort_order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-ipa-1d', question_id: 'q-ipa-1', option_key: 'D', option_text: 'Fermentasi', is_correct: false, sort_order: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]
  },
  {
    id: 'q-ipa-2',
    subject_id: 'sub-ipa',
    category_id: 'cat-ipa-2',
    question_text: 'Perubahan wujud benda dari zat cair menjadi gas dinamakan ...',
    question_type: 'MULTIPLE_CHOICE',
    explanation: 'Perubahan cair ke gas adalah menguap. Padat ke cair = mencair; gas ke cair = mengembun.',
    difficulty: 'MUDAH',
    points: 4,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    options: [
      { id: 'opt-ipa-2a', question_id: 'q-ipa-2', option_key: 'A', option_text: 'Membeku', is_correct: false, sort_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-ipa-2b', question_id: 'q-ipa-2', option_key: 'B', option_text: 'Menguap', is_correct: true, sort_order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-ipa-2c', question_id: 'q-ipa-2', option_key: 'C', option_text: 'Menyublim', is_correct: false, sort_order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-ipa-2d', question_id: 'q-ipa-2', option_key: 'D', option_text: 'Mengembun', is_correct: false, sort_order: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]
  },

  // 4. PAI
  {
    id: 'q-pai-1',
    subject_id: 'sub-pai',
    category_id: 'cat-pai-1',
    question_text: 'Berapakah jumlah rukun iman dalam ajaran Islam yang wajib diyakini setiap muslim?',
    question_type: 'MULTIPLE_CHOICE',
    explanation: 'Rukun Iman ada 6: Iman kepada Allah, Malaikat, Kitab-kitab, Rasul, Hari Akhir, dan Qada & Qadar.',
    difficulty: 'MUDAH',
    points: 4,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    options: [
      { id: 'opt-pai-1a', question_id: 'q-pai-1', option_key: 'A', option_text: '4 Rukun', is_correct: false, sort_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-pai-1b', question_id: 'q-pai-1', option_key: 'B', option_text: '5 Rukun', is_correct: false, sort_order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-pai-1c', question_id: 'q-pai-1', option_key: 'C', option_text: '6 Rukun', is_correct: true, sort_order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-pai-1d', question_id: 'q-pai-1', option_key: 'D', option_text: '7 Rukun', is_correct: false, sort_order: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]
  },
  {
    id: 'q-pai-2',
    subject_id: 'sub-pai',
    category_id: 'cat-pai-1',
    question_text: 'Shalat fardhu yang boleh diqashar (diringkas dari 4 rakaat menjadi 2 rakaat) saat bepergian jauh (safar) adalah ...',
    question_type: 'MULTIPLE_CHOICE',
    explanation: 'Shalat yang dapat diqashar adalah shalat yang berjumlah 4 rakaat yaitu Zhuhur, Ashar, dan Isya. Shubuh dan Maghrib tidak boleh diqashar.',
    difficulty: 'SEDANG',
    points: 4,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    options: [
      { id: 'opt-pai-2a', question_id: 'q-pai-2', option_key: 'A', option_text: 'Shubuh, Zhuhur, dan Ashar', is_correct: false, sort_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-pai-2b', question_id: 'q-pai-2', option_key: 'B', option_text: 'Zhuhur, Ashar, dan Isya', is_correct: true, sort_order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-pai-2c', question_id: 'q-pai-2', option_key: 'C', option_text: 'Maghrib dan Isya', is_correct: false, sort_order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-pai-2d', question_id: 'q-pai-2', option_key: 'D', option_text: 'Semua shalat lima waktu', is_correct: false, sort_order: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]
  },
  {
    id: 'q-pai-3',
    subject_id: 'sub-pai',
    category_id: 'cat-pai-2',
    question_text: 'Nabi Muhammad SAW dilahirkan pada tahun yang dikenal dengan peristiwa penyerangan Ka\'bah oleh pasukan gajah pimpinan Abrahah (Tahun Gajah).',
    question_type: 'TRUE_FALSE',
    explanation: 'Benar, kelahiran Rasulullah bertepatan dengan Tahun Gajah (571 Masehi), sebagaimana diabadikan dalam Surah Al-Fil.',
    difficulty: 'MUDAH',
    points: 4,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    options: [
      { id: 'opt-pai-3a', question_id: 'q-pai-3', option_key: 'BENAR', option_text: 'Benar', is_correct: true, sort_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-pai-3b', question_id: 'q-pai-3', option_key: 'SALAH', option_text: 'Salah', is_correct: false, sort_order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]
  },

  // 5. PENGETAHUAN UMUM
  {
    id: 'q-umum-1',
    subject_id: 'sub-umum',
    category_id: 'cat-umum-1',
    question_text: 'Sila kedua Pancasila berbunyi "Kemanusiaan yang adil dan beradab". Lambang dari sila kedua pada perisai Garuda Pancasila adalah ...',
    question_type: 'MULTIPLE_CHOICE',
    explanation: '1: Bintang, 2: Rantai Emas, 3: Pohon Beringin, 4: Kepala Banteng, 5: Padi dan Kapas.',
    difficulty: 'MUDAH',
    points: 4,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    options: [
      { id: 'opt-umum-1a', question_id: 'q-umum-1', option_key: 'A', option_text: 'Bintang Emas', is_correct: false, sort_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-umum-1b', question_id: 'q-umum-1', option_key: 'B', option_text: 'Rantai Emas', is_correct: true, sort_order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-umum-1c', question_id: 'q-umum-1', option_key: 'C', option_text: 'Pohon Beringin', is_correct: false, sort_order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-umum-1d', question_id: 'q-umum-1', option_key: 'D', option_text: 'Kepala Banteng', is_correct: false, sort_order: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]
  },
  {
    id: 'q-umum-2',
    subject_id: 'sub-umum',
    category_id: 'cat-umum-2',
    question_text: 'Bulan pertama dalam penanggalan kalender Islam (Hijriyah) adalah bulan ...',
    question_type: 'MULTIPLE_CHOICE',
    explanation: 'Urutan bulan Hijriyah diawali oleh Muharram, Safar, Rabi\'ul Awwal, hingga Dzulhijjah.',
    difficulty: 'MUDAH',
    points: 4,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    options: [
      { id: 'opt-umum-2a', question_id: 'q-umum-2', option_key: 'A', option_text: 'Ramadhan', is_correct: false, sort_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-umum-2b', question_id: 'q-umum-2', option_key: 'B', option_text: 'Muharram', is_correct: true, sort_order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-umum-2c', question_id: 'q-umum-2', option_key: 'C', option_text: 'Syawal', is_correct: false, sort_order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'opt-umum-2d', question_id: 'q-umum-2', option_key: 'D', option_text: 'Rabi\'ul Awwal', is_correct: false, sort_order: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]
  },
];

export const defaultExams: Exam[] = [
  {
    id: 'exam-cbt-akademik-1',
    test_schedule_id: 'sch-1', // Connected to Sesi Ujian Akademik
    title: 'Tes Potensi Akademik PSB TP 2027/2028',
    description: 'Ujian seleksi berbasis komputer materi Matematika, Bahasa Indonesia, IPA, PAI, dan Pengetahuan Umum calon santri jenjang SMP.',
    duration_minutes: 90,
    total_questions: 14,
    randomize_questions: true,
    randomize_options: true,
    max_attempts: 1,
    passing_score: 70,
    is_active: true,
    show_score_to_candidate: false, // Default false as specified
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

export const defaultExamConfigs: ExamQuestionConfig[] = [
  { id: 'cfg-1', exam_id: 'exam-cbt-akademik-1', subject_id: 'sub-mtk', question_count: 4, points_per_question: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'cfg-2', exam_id: 'exam-cbt-akademik-1', subject_id: 'sub-bind', question_count: 3, points_per_question: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'cfg-3', exam_id: 'exam-cbt-akademik-1', subject_id: 'sub-ipa', question_count: 2, points_per_question: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'cfg-4', exam_id: 'exam-cbt-akademik-1', subject_id: 'sub-pai', question_count: 3, points_per_question: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'cfg-5', exam_id: 'exam-cbt-akademik-1', subject_id: 'sub-umum', question_count: 2, points_per_question: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];
