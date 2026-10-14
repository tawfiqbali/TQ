// Starting teacher directory. Loaded automatically the first time the portal
// opens with no teachers; every teacher gets a sequential ID (QIT-001 …).
export const TEACHER_SEED = {
  Residential: [
    'Abu Bakar Siddique', 'Mr. Ibrahim', 'Mr. Atiqur Rahman', 'Mr. Sibgatullah', 'Mr. Masudur Rahman', 'Mr. Sabbir Khan',
    'Mr. Munirul Islam', 'Mr. Abdul Halim', 'Mr. Said Anwar', 'Mr. Khalid', 'Mr. Mobarak', 'Mr. Rumman', 'Sabbir Ahmad',
    'Mr. Nasir', 'Mr. Abu Sayeed',
  ],
  'Non-Residential Male': [
    'Mr. Rabbani', 'Sifatullah Mishor', 'Abu Sufian', 'Sanaullah Markaz', 'Mr. Riaz', 'Osama Khan', 'Rashedul Islam',
    'Ashiqur Rahman Markaz', 'Mr. Hedayetullah', 'Muaz bin Habib', 'Mainul Islam (English)', 'Kamrul Islam Azhari',
    'Abdur Rahman', 'Abdullah Fahad', 'Mir Muhammad', 'Mr. Hamza', 'Osama bin Saif', 'Rafi Habib Azhari', 'Alamin Sadi',
    'Rakin Muaz', 'Ahmad Hasan', 'Sheikh Al-Amin Azhari', 'Hasan Mahmud Azhari', 'Monirul Islam (IOM)', 'Nayamul Islam',
    'Abdullah Tongi', 'Haider Ali', 'Mr. Imran', 'Muinul Islam', 'Junaid Ahmed', 'Fayzur Rahman Azhari', 'Shamim Ahmed',
    'Nahidul Islam',
  ],
  'Non-Residential Female': [
    'Sanjida Islam', 'Afroza Sultana', 'Umme Miqdad', 'Mrs. Wasif', 'Hure Jannat', 'Antara Labiba', 'Amatullah Surayya',
    'Sadia Khanam', 'Habiba Islam', 'Humaira Doctor', 'Hafsa Sharif', 'Sumaiya Sadi', 'Hafeza Amatullah',
    'Hafeza Sumaiya Akter', 'Nur Nahar', 'Shanta Islam', 'Habiba Sultana', 'Maria Islam', 'Umme Atika', 'Sumaiya (Engr.)',
    'Amatullah Jannat', 'Abrar Shah Jahan', 'Sadia Mohib', 'Taiyeba Anjam', 'Umme Zakwan', 'Humaira Khatun',
    'Female Examiner', 'Female Admin',
  ],
};

// Teacher IDs: QIT-001, QIT-002, … continuing after the highest number in use
export const TEACHER_ID_PREFIX = 'QIT-';
export function nextTeacherIds(existing, count) {
  let max = existing.reduce((m, t) => Math.max(m, Number(String(t.id || t).replace(/\D/g, '')) || 0), 0);
  return Array.from({ length: count }, () => `${TEACHER_ID_PREFIX}${String(++max).padStart(3, '0')}`);
}

// Seed teachers not yet in the list (matched by name), with new IDs
export function seedTeachersFor(existing) {
  const have = new Set(existing.map((t) => String(t.name).trim().toLowerCase()));
  const rows = [];
  Object.entries(TEACHER_SEED).forEach(([category, names]) =>
    names.forEach((name) => {
      if (!have.has(name.toLowerCase())) rows.push({ name, category });
    }),
  );
  const ids = nextTeacherIds(existing, rows.length);
  return rows.map((r, i) => ({
    id: ids[i],
    name: r.name,
    category: r.category,
    whatsapp: 'N/A',
    method: 'Other',
    account: 'N/A',
    salaryType: 'Per-Student',
    packageAmount: 0,
    bankName: '',
    branchName: '',
    status: 'Active',
  }));
}
