// Legal and info pages shown inside the app (App Store guideline 5.1.1(i):
// the privacy policy must be easy to reach in the app). Written to match how
// Oracle actually works: no account, no server, data stays on the device.
// Have a lawyer review these before publishing commercially.
import { APP } from './config.js';
import { lang } from './i18n.js';

const fmtDate = () =>
  new Date(APP.legalUpdated + 'T00:00:00').toLocaleDateString(lang() === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });

const contact = () => (APP.supportEmail ? APP.supportEmail : null);

// Each page: { title, intro?, sections: [{ heading, body: [paragraph | ['list item', ...]] }] }
const PAGES = {
  privacy: {
    en: () => ({
      title: 'Privacy Policy',
      intro: `Last updated ${fmtDate()}. In short: Oracle keeps your expenses on your device. We don’t collect, see, sell or share your data.`,
      sections: [
        { heading: 'What Oracle stores', body: ['The expenses you log (amount, date, category, place, item, meal time, payment method, notes), your settings (name, budget, categories, payment methods, appearance, language, reminder preferences) and a random device ID used only to label sync files.'] },
        { heading: 'Where it is stored', body: ['Only on this device, in the app’s private storage. Oracle has no account, no server and no cloud copy. We (the developer) cannot access your data.'] },
        { heading: 'What we collect', body: ['Nothing. Oracle contains no analytics, advertising, tracking or crash-reporting tools and does not send your data anywhere.'] },
        { heading: 'Sync files and exports', body: ['When you choose to send a sync file or export to Excel/CSV, Oracle creates a file on your device. Where that file goes (Quick Share, AirDrop, email, a cloud drive) is your choice and is handled by that service, not by Oracle. Treat these files as private: anyone who has one can read the expenses in it.'] },
        { heading: 'Notifications', body: ['Reminders are optional and created on your device from your own logging habits. They never include amounts unless you turn that on. You can turn them off at any time in You → Notifications or in your phone’s settings.'] },
        { heading: 'Internet use', body: ['Oracle works offline. It may load fonts and the app files from its web address. The optional “Import from the old Ledger version” connects to the old cloud database once, only when you press it.'] },
        { heading: 'Keeping and deleting your data', body: ['Your data stays until you delete it. You can delete single expenses, delete several at once in Activity, or erase everything in You → Delete all data. Deleting the app (or clearing the browser’s site data) also removes it. Because nothing is stored by us, there is nothing for us to delete on our side.'] },
        { heading: 'Children', body: ['Oracle is a general personal-finance tool and is not directed at children under 13.'] },
        { heading: 'Changes', body: ['If this policy changes, the new version will be shown here with a new date.'] },
        { heading: 'Contact', body: [contact() ? `Questions about privacy: ${contact()}` : 'Questions about privacy: see Contact support in the You tab.'] },
      ],
    }),
    id: () => ({
      title: 'Kebijakan Privasi',
      intro: `Terakhir diperbarui ${fmtDate()}. Singkatnya: Oracle menyimpan pengeluaranmu di perangkatmu. Kami tidak mengumpulkan, melihat, menjual, atau membagikan datamu.`,
      sections: [
        { heading: 'Apa yang disimpan Oracle', body: ['Pengeluaran yang kamu catat (nominal, tanggal, kategori, tempat, item, waktu makan, metode pembayaran, catatan), pengaturanmu (nama, budget, kategori, metode pembayaran, tampilan, bahasa, preferensi pengingat), dan ID perangkat acak yang hanya dipakai untuk memberi label file sync.'] },
        { heading: 'Di mana disimpan', body: ['Hanya di perangkat ini, di penyimpanan pribadi aplikasi. Oracle tidak punya akun, server, atau salinan di cloud. Kami (pengembang) tidak bisa mengakses datamu.'] },
        { heading: 'Data yang kami kumpulkan', body: ['Tidak ada. Oracle tidak memakai analitik, iklan, pelacakan, atau pelaporan error, dan tidak mengirim datamu ke mana pun.'] },
        { heading: 'File sync dan ekspor', body: ['Saat kamu mengirim file sync atau mengekspor ke Excel/CSV, Oracle membuat file di perangkatmu. Ke mana file itu dikirim (Quick Share, AirDrop, email, cloud) adalah pilihanmu dan ditangani layanan tersebut, bukan Oracle. Jaga kerahasiaan file ini: siapa pun yang memegangnya bisa membaca pengeluaran di dalamnya.'] },
        { heading: 'Notifikasi', body: ['Pengingat bersifat opsional dan dibuat di perangkatmu berdasarkan kebiasaan mencatatmu sendiri. Pengingat tidak pernah menampilkan nominal kecuali kamu mengaktifkannya. Kamu bisa mematikannya kapan saja di You → Notifikasi atau di pengaturan HP.'] },
        { heading: 'Penggunaan internet', body: ['Oracle bekerja offline. Aplikasi mungkin memuat font dan file aplikasi dari alamat webnya. Fitur opsional “Impor dari Ledger versi lama” terhubung ke database cloud lama satu kali, hanya saat kamu menekannya.'] },
        { heading: 'Menyimpan dan menghapus data', body: ['Datamu tetap ada sampai kamu menghapusnya. Kamu bisa menghapus satu pengeluaran, menghapus beberapa sekaligus di Aktivitas, atau menghapus semuanya di You → Hapus semua data. Menghapus aplikasi (atau data situs di browser) juga menghapusnya. Karena kami tidak menyimpan apa pun, tidak ada data yang perlu kami hapus di pihak kami.'] },
        { heading: 'Anak-anak', body: ['Oracle adalah alat keuangan pribadi umum dan tidak ditujukan untuk anak di bawah 13 tahun.'] },
        { heading: 'Perubahan', body: ['Jika kebijakan ini berubah, versi barunya akan ditampilkan di sini dengan tanggal baru.'] },
        { heading: 'Kontak', body: [contact() ? `Pertanyaan soal privasi: ${contact()}` : 'Pertanyaan soal privasi: lihat Hubungi dukungan di tab You.'] },
      ],
    }),
  },
  terms: {
    en: () => ({
      title: 'Terms of Use',
      intro: `Last updated ${fmtDate()}. By using Oracle you agree to these terms.`,
      sections: [
        { heading: 'What Oracle is', body: ['Oracle is a personal record-keeping tool for your own expenses. It does not connect to banks, does not move money and does not provide financial, tax, legal or investment advice.'] },
        { heading: 'Your data, your responsibility', body: ['Your data is stored only on your device. Oracle cannot recover it if the device is lost, reset or the app is deleted. Send a sync file or export regularly to keep a backup.'] },
        { heading: 'Accuracy', body: ['Totals, budgets and insights are calculated from what you enter. Check important figures yourself before relying on them.'] },
        { heading: 'Acceptable use', body: ['Use Oracle for lawful, personal purposes. Don’t attempt to break, copy or misuse the app.'] },
        { heading: 'No warranty', body: ['Oracle is provided “as is”, without warranties of any kind. To the extent permitted by law, the developer is not liable for losses arising from use of the app, including lost data or decisions made from it.'] },
        { heading: 'App store terms', body: ['If you got Oracle from the Apple App Store, Apple’s Standard Licensed Application End User License Agreement also applies.'] },
        { heading: 'Changes', body: ['These terms may be updated; the new version will appear here with a new date.'] },
      ],
    }),
    id: () => ({
      title: 'Ketentuan Penggunaan',
      intro: `Terakhir diperbarui ${fmtDate()}. Dengan memakai Oracle, kamu menyetujui ketentuan ini.`,
      sections: [
        { heading: 'Apa itu Oracle', body: ['Oracle adalah alat pencatatan pribadi untuk pengeluaranmu sendiri. Oracle tidak terhubung ke bank, tidak memindahkan uang, dan tidak memberikan nasihat keuangan, pajak, hukum, atau investasi.'] },
        { heading: 'Datamu, tanggung jawabmu', body: ['Datamu hanya tersimpan di perangkatmu. Oracle tidak bisa memulihkannya jika perangkat hilang, di-reset, atau aplikasinya dihapus. Kirim file sync atau ekspor secara rutin sebagai cadangan.'] },
        { heading: 'Ketepatan', body: ['Total, budget, dan insight dihitung dari data yang kamu masukkan. Periksa sendiri angka penting sebelum mengandalkannya.'] },
        { heading: 'Penggunaan yang wajar', body: ['Gunakan Oracle untuk keperluan pribadi yang sah. Jangan mencoba merusak, menyalin, atau menyalahgunakan aplikasi.'] },
        { heading: 'Tanpa jaminan', body: ['Oracle disediakan “apa adanya”, tanpa jaminan apa pun. Sejauh diizinkan hukum, pengembang tidak bertanggung jawab atas kerugian akibat penggunaan aplikasi, termasuk data yang hilang atau keputusan yang diambil berdasarkan aplikasi.'] },
        { heading: 'Ketentuan app store', body: ['Jika kamu mengunduh Oracle dari Apple App Store, Standard Licensed Application End User License Agreement dari Apple juga berlaku.'] },
        { heading: 'Perubahan', body: ['Ketentuan ini bisa diperbarui; versi barunya akan muncul di sini dengan tanggal baru.'] },
      ],
    }),
  },
  disclaimer: {
    en: () => ({
      title: 'Financial disclaimer',
      sections: [
        { heading: 'Not financial advice', body: ['Oracle helps you record and look back on your own spending. Nothing in the app (totals, budgets, insights, reminders) is financial, tax, legal or investment advice.'] },
        { heading: 'Not a bank or payment service', body: ['Oracle does not hold money, connect to bank accounts, make payments or transfers. Amounts are only what you type in.'] },
        { heading: 'Your decisions', body: ['Decisions you make based on what you see in Oracle are your own. For advice about your situation, talk to a qualified professional.'] },
      ],
    }),
    id: () => ({
      title: 'Penafian keuangan',
      sections: [
        { heading: 'Bukan nasihat keuangan', body: ['Oracle membantumu mencatat dan meninjau pengeluaranmu sendiri. Tidak ada apa pun di aplikasi ini (total, budget, insight, pengingat) yang merupakan nasihat keuangan, pajak, hukum, atau investasi.'] },
        { heading: 'Bukan bank atau layanan pembayaran', body: ['Oracle tidak menyimpan uang, tidak terhubung ke rekening bank, dan tidak melakukan pembayaran atau transfer. Nominal hanyalah yang kamu ketik.'] },
        { heading: 'Keputusanmu', body: ['Keputusan yang kamu ambil berdasarkan apa yang kamu lihat di Oracle adalah tanggung jawabmu sendiri. Untuk saran sesuai kondisimu, konsultasikan dengan profesional yang kompeten.'] },
      ],
    }),
  },
  licenses: {
    en: () => ({
      title: 'Open-source licenses',
      intro: 'Oracle is built with these open-source works. Thank you to their authors.',
      sections: [
        { heading: 'Space Grotesk', body: ['Typeface by Florian Karsten. SIL Open Font License 1.1.'] },
        { heading: 'Manrope', body: ['Typeface by Mikhail Sharanda. SIL Open Font License 1.1.'] },
        { heading: 'Lucide (settings icon)', body: ['Icon set by Lucide contributors. ISC License.'] },
      ],
    }),
    id: () => ({
      title: 'Lisensi open-source',
      intro: 'Oracle dibuat dengan karya open-source berikut. Terima kasih kepada para pembuatnya.',
      sections: [
        { heading: 'Space Grotesk', body: ['Huruf karya Florian Karsten. SIL Open Font License 1.1.'] },
        { heading: 'Manrope', body: ['Huruf karya Mikhail Sharanda. SIL Open Font License 1.1.'] },
        { heading: 'Lucide (ikon pengaturan)', body: ['Set ikon oleh kontributor Lucide. ISC License.'] },
      ],
    }),
  },
};

export function legalPage(key) {
  const page = PAGES[key];
  return (page[lang()] || page.en)();
}
