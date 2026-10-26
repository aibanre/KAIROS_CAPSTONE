import { FaChevronLeft, FaChevronRight } from 'react-icons/fa'

function getPageNumbers(page, pageCount) {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1)

    const pages = [1]
    const start = Math.max(2, page - 1)
    const end = Math.min(pageCount - 1, page + 1)

    if (start > 2) pages.push('start-ellipsis')
    for (let number = start; number <= end; number += 1) pages.push(number)
    if (end < pageCount - 1) pages.push('end-ellipsis')
    pages.push(pageCount)
    return pages
}

export default function Pagination({ page, pageSize, totalItems, onPageChange }) {
    if (totalItems <= 0) return null

    const pageCount = Math.ceil(totalItems / pageSize)
    const currentPage = Math.min(Math.max(1, page), pageCount)
    const firstItem = (currentPage - 1) * pageSize + 1
    const lastItem = Math.min(currentPage * pageSize, totalItems)

    return (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            <span>Showing {firstItem}-{lastItem} of {totalItems}</span>
            {pageCount > 1 ? <>
                <div className="flex items-center gap-2 sm:hidden">
                    <button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} className="rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
                        <FaChevronLeft className="inline h-3 w-3" /> <span>Previous</span>
                    </button>
                    <span className="whitespace-nowrap text-xs">Page {currentPage} of {pageCount}</span>
                    <button type="button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => onPageChange(currentPage + 1)} className="rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
                        <span>Next</span> <FaChevronRight className="inline h-3 w-3" />
                    </button>
                </div>
                <nav aria-label="Pagination" className="hidden items-center gap-1 sm:flex">
                    <button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} className="rounded-lg border border-slate-200 p-2 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
                        <FaChevronLeft className="h-3 w-3" />
                    </button>
                    {getPageNumbers(currentPage, pageCount).map((item) => typeof item === 'number'
                        ? <button key={item} type="button" aria-current={currentPage === item ? 'page' : undefined} onClick={() => onPageChange(item)} className={`min-w-9 rounded-lg border px-3 py-2 font-medium ${currentPage === item ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>{item}</button>
                        : <span key={item} aria-hidden="true" className="px-1 text-slate-500">…</span>)}
                    <button type="button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => onPageChange(currentPage + 1)} className="rounded-lg border border-slate-200 p-2 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
                        <FaChevronRight className="h-3 w-3" />
                    </button>
                </nav>
            </> : null}
        </footer>
    )
}
