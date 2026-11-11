import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronRight as Arrow, Megaphone, X } from 'lucide-react'

/**
 * "What's new" announcement shown as a slide carousel.
 *
 * Shown once per device per release: the dismissed release id is kept in localStorage,
 * so a new device (or a fresh browser) sees it right after logging in. Bump RELEASE_ID
 * and replace SLIDES when announcing the next set of features.
 */
export const WHATS_NEW_RELEASE_ID = '2026-11-manual-projects'
const STORAGE_KEY = 'massweb_whats_new_seen'

interface Slide {
    image: string
    title: string
    description: string
    /** Navigation path, e.g. ['Projects', 'Open a project', 'Draft all queued'] */
    path?: string[]
    bullets?: string[]
}

const SLIDES: Slide[] = [
    {
        image: '/whats-new/overview.png',
        title: 'Yang baru di Massweb',
        description:
            'Artikel kini bisa disimpan sebagai draft dalam jumlah banyak, dipublish manual kapan pun Anda siap, dan dibuat satu per satu di luar generate massal.',
        bullets: [
            'Tipe project baru: Manual. Tanpa import Excel, artikel ditulis satu per satu.',
            'Menu Categories kini ada langsung di navbar.',
            'Buat artikel satuan dari template project atau tulis manual.',
            'Status baru Draft: tidak pernah ikut Auto Publish dan tidak muncul di public API.',
            'Panel Auto Publish dan Manual Publish kini dipisah di halaman project.',
            'Halaman baru Drafts untuk meninjau & publish draft dari semua project.',
        ],
    },
    {
        image: '/whats-new/manual-project.png',
        title: 'Project manual',
        description:
            'Satu organisasi kini bisa punya dua tipe project. Project Mass tetap seperti biasa (import CSV/Excel + template). Project Manual tidak perlu import atau template: isinya artikel yang ditulis satu per satu.',
        path: ['Projects', 'New project', 'Project type', 'Manual project', 'Create manual project'],
        bullets: [
            'Artikel manual tetap bisa ditambahkan ke project Mass.',
            'Filter All / Mass / Manual tersedia di daftar project.',
            'Kelola kategori lewat menu Categories di navbar.',
        ],
    },
    {
        image: '/whats-new/new-article.png',
        title: 'Buat artikel satuan',
        description:
            'Bikin satu artikel tanpa generate massal. Pilih project, isi variabel seperti satu baris CSV, klik "Fill from template", lalu sesuaikan isinya. Atau pilih "Write manually" untuk menulis sendiri. Artikel satuan tidak ikut terhapus saat project di-generate ulang.',
        path: ['Contents', 'New article', 'Pilih project', 'Isi variabel', 'Fill from template', 'Create draft'],
    },
    {
        image: '/whats-new/generate-draft.png',
        title: 'Generate langsung jadi draft',
        description:
            'Saat membuat project, pilih ke mana hasil generate disimpan. Pilih "Save as drafts" agar semua artikel tidak langsung masuk antrian publish.',
        path: ['Projects', 'New project', 'After generating', 'Save as drafts', 'Create & generate drafts'],
    },
    {
        image: '/whats-new/manual-panel.png',
        title: 'Draft massal dalam satu klik',
        description:
            'Pindahkan semua artikel di antrian ke draft sekaligus, kembalikan semua draft ke antrian, atau publish semua draft sekarang juga.',
        path: ['Projects', 'Buka project', 'Panel "Manual Publish & Drafts"', 'Draft all queued'],
    },
    {
        image: '/whats-new/bulk-select.png',
        title: 'Pilih banyak artikel sekaligus',
        description:
            'Centang artikel (atau centang header untuk memilih satu halaman). Bar aksi muncul di bawah layar: Publish now, Move to draft, Queue, atau Delete.',
        path: ['Projects', 'Buka project', 'Centang artikel', 'Pilih aksi di bar bawah'],
    },
    {
        image: '/whats-new/drafts-page.png',
        title: 'Halaman Drafts: publish manual terpisah',
        description:
            'Semua draft dari seluruh project dalam satu tempat. Filter per project, pilih yang siap, lalu publish manual. Artikel langsung live.',
        path: ['Menu Drafts', 'Centang draft', 'Publish now'],
    },
    {
        image: '/whats-new/editor-publishing.png',
        title: 'Publish langsung dari editor',
        description:
            'Saat mengedit artikel, gunakan panel Publishing untuk menyimpan sekaligus publish, menyimpan sebagai draft, atau memasukkan ke antrian.',
        path: ['Contents', 'Klik judul artikel', 'Panel Publishing', 'Save & publish now'],
        bullets: ['Popup ini bisa dibuka lagi kapan saja lewat tombol "What\'s new" di navbar.'],
    },
]

export function hasSeenWhatsNew(): boolean {
    try {
        return localStorage.getItem(STORAGE_KEY) === WHATS_NEW_RELEASE_ID
    } catch {
        return true // storage unavailable: don't nag
    }
}

function markWhatsNewSeen() {
    try {
        localStorage.setItem(STORAGE_KEY, WHATS_NEW_RELEASE_ID)
    } catch {
        // ignore
    }
}

interface WhatsNewModalProps {
    open: boolean
    onClose: () => void
}

export function WhatsNewModal({ open, onClose }: WhatsNewModalProps) {
    const [index, setIndex] = useState(0)
    const slide = SLIDES[index]
    const isLast = index === SLIDES.length - 1

    const close = useCallback(() => {
        markWhatsNewSeen()
        onClose()
    }, [onClose])

    useEffect(() => {
        if (open) setIndex(0)
    }, [open])

    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close()
            if (e.key === 'ArrowRight') setIndex((i) => Math.min(SLIDES.length - 1, i + 1))
            if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
        }
        window.addEventListener('keydown', onKey)
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            window.removeEventListener('keydown', onKey)
            document.body.style.overflow = prevOverflow
        }
    }, [open, close])

    // Preload the next image so slides switch instantly
    useEffect(() => {
        if (!open || isLast) return
        const img = new Image()
        img.src = SLIDES[index + 1].image
    }, [open, index, isLast])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="whats-new-title">
            <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={close} />

            <div className="relative flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl">
                <button
                    onClick={close}
                    className="absolute top-3 right-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-500 shadow-sm ring-1 ring-gray-200 transition hover:bg-white hover:text-gray-900"
                    aria-label="Tutup"
                >
                    <X className="h-4 w-4" />
                </button>

                <div className="min-h-0 flex-1 overflow-y-auto md:grid md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                    {/* Screenshot */}
                    <div className="flex items-center border-b border-gray-200 bg-gradient-to-br from-blue-50 via-gray-50 to-purple-50 p-4 sm:p-6 md:border-r md:border-b-0">
                        <div className="w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                            <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50 px-3 py-2">
                                <span className="h-2 w-2 rounded-full bg-gray-300" />
                                <span className="h-2 w-2 rounded-full bg-gray-300" />
                                <span className="h-2 w-2 rounded-full bg-gray-300" />
                            </div>
                            <a href={slide.image} target="_blank" rel="noreferrer" title="Klik untuk memperbesar" className="block cursor-zoom-in">
                                <img
                                    key={slide.image}
                                    src={slide.image}
                                    alt={slide.title}
                                    className="aspect-[16/9] w-full bg-gray-50 object-cover object-top"
                                />
                            </a>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="px-5 py-5 sm:px-7 sm:py-7">
                        <div className="mb-2 flex items-center gap-2 text-xs font-medium">
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                                <Megaphone className="h-3 w-3" /> Fitur baru
                            </span>
                            <span className="text-gray-400 tabular-nums">
                                {index + 1} / {SLIDES.length}
                            </span>
                        </div>
                        <h2 id="whats-new-title" className="pr-8 text-xl font-semibold tracking-tight text-gray-900">
                            {slide.title}
                        </h2>
                        <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{slide.description}</p>

                        {slide.path && (
                            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                                <p className="mb-2 text-[11px] font-semibold tracking-wide text-gray-500 uppercase">Cara membuka</p>
                                <ol className="flex flex-wrap items-center gap-1.5 text-sm">
                                    {slide.path.map((step, i) => (
                                        <li key={step} className="flex items-center gap-1.5">
                                            <span
                                                className={`rounded-md px-2 py-0.5 font-medium ${i === slide.path!.length - 1 ? 'bg-blue-600 text-white' : 'border border-gray-200 bg-white text-gray-800'}`}
                                            >
                                                {i + 1}. {step}
                                            </span>
                                            {i < slide.path!.length - 1 && <Arrow className="h-3.5 w-3.5 text-gray-400" />}
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}

                        {slide.bullets && (
                            <ul className="mt-4 space-y-1.5 text-sm text-gray-600">
                                {slide.bullets.map((b) => (
                                    <li key={b} className="flex gap-2">
                                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                                        {b}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 px-5 py-3.5 sm:px-8">
                    <div className="flex items-center gap-1.5">
                        {SLIDES.map((s, i) => (
                            <button
                                key={s.image}
                                onClick={() => setIndex(i)}
                                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-blue-600' : 'w-1.5 bg-gray-300 hover:bg-gray-400'}`}
                                aria-label={`Slide ${i + 1}`}
                            />
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        {index === 0 ? (
                            <button className="btn btn-ghost btn-sm" onClick={close}>
                                Lewati
                            </button>
                        ) : (
                            <button className="btn btn-ghost btn-sm" onClick={() => setIndex(index - 1)}>
                                <ChevronLeft /> Sebelumnya
                            </button>
                        )}
                        {isLast ? (
                            <button className="btn btn-primary btn-sm" onClick={close}>
                                Mulai pakai
                            </button>
                        ) : (
                            <button className="btn btn-primary btn-sm" onClick={() => setIndex(index + 1)}>
                                Berikutnya <ChevronRight />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
