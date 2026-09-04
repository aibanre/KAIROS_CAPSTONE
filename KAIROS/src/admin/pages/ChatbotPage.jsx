import { useState } from 'react'
import { FaBookOpen, FaEdit, FaPlus, FaTrash } from 'react-icons/fa'

const defaultFaqs = [
    'What time is check-in?',
    'Is parking available?',
    'Do you allow pets?',
    'What is the cancellation policy?',
]

const defaultUnansweredQuestions = [
    'Can I bring my own food?',
    'Is there a shuttle from the airport?',
    'Do you offer underwater activities?',
]

const defaultConversations = [
    { guest: 'Guest_491', time: '10:24 AM', question: 'What rooms are available for July 15?' },
    { guest: 'Guest_388', time: '9:15 AM', question: 'How much is the Beachfront Pavilion?' },
    { guest: 'Guest_271', time: '8:02 AM', question: 'Is breakfast included in the room price?' },
]

const defaultKnowledgeBase = [
    'Room Information',
    'Pricing & Packages',
    'Amenities',
    'Booking Process',
    'Resort Policies',
    'Contact Information',
]

function Panel({ title, children, action }) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.10)]">
            <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
                {action}
            </div>
            {children}
        </section>
    )
}

export default function ChatbotPage({
    faqs = defaultFaqs,
    unansweredQuestions = defaultUnansweredQuestions,
    conversations = defaultConversations,
    knowledgeBase = defaultKnowledgeBase,
    onAddFaq,
    onEditFaq,
    onDeleteFaq,
    onAddQuestion,
    onEditKnowledge,
}) {
    const [faqItems, setFaqItems] = useState(faqs)

    const deleteFaq = (faq) => {
        setFaqItems((items) => items.filter((item) => item !== faq))
        onDeleteFaq?.(faq)
    }

    return (
        <div className="mx-auto max-w-7xl">
            <h1 className="mb-5 text-2xl font-bold text-slate-800">Chatbot Management</h1>

            <div className="grid gap-5 lg:grid-cols-2">
                <Panel
                    title={<span>Frequently Asked<br />Questions</span>}
                    action={<button type="button" onClick={onAddFaq} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700"><FaPlus className="h-3 w-3" />Add FAQ</button>}
                >
                    <div className="mt-4 space-y-2">
                        {faqItems.map((faq) => (
                            <div key={faq} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-700">
                                <span>{faq}</span>
                                <div className="flex items-center gap-3">
                                    <button type="button" aria-label={`Edit ${faq}`} title="Edit FAQ" onClick={() => onEditFaq?.(faq)} className="text-sky-500 transition hover:text-sky-700"><FaEdit className="h-3 w-3" /></button>
                                    <button type="button" aria-label={`Delete ${faq}`} title="Delete FAQ" onClick={() => deleteFaq(faq)} className="text-rose-400 transition hover:text-rose-600"><FaTrash className="h-3 w-3" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </Panel>

                <Panel title="Unanswered Questions">
                    <div className="mt-4 space-y-2">
                        {unansweredQuestions.map((question) => (
                            <div key={question} className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                                <span>{question}</span>
                                <button type="button" onClick={() => onAddQuestion?.(question)} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-amber-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-600"><FaPlus className="h-3 w-3" />Add</button>
                            </div>
                        ))}
                    </div>
                </Panel>

                <Panel title="Conversation History">
                    <div className="mt-4 space-y-3">
                        {conversations.map((conversation) => (
                            <article key={`${conversation.guest}-${conversation.time}`} className="rounded-xl border border-slate-200 px-3 py-3">
                                <div className="flex justify-between gap-3 text-xs text-slate-400"><span>{conversation.guest}</span><span>{conversation.time}</span></div>
                                <p className="mt-2 text-sm text-slate-700">{conversation.question}</p>
                            </article>
                        ))}
                    </div>
                </Panel>

                <Panel title="Knowledge Base">
                    <div className="mt-4 space-y-1">
                        {knowledgeBase.map((item) => (
                            <div key={item} className="flex items-center justify-between gap-3 px-2 py-2.5 text-sm text-slate-700">
                                <span className="flex items-center gap-3"><FaBookOpen className="h-3.5 w-3.5 text-sky-500" />{item}</span>
                                <button type="button" aria-label={`Edit ${item}`} title="Edit knowledge base item" onClick={() => onEditKnowledge?.(item)} className="text-sky-500 transition hover:text-sky-700"><FaEdit className="h-3 w-3" /></button>
                            </div>
                        ))}
                    </div>
                </Panel>
            </div>
        </div>
    )
}
