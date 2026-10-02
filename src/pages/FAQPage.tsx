import React, { useState } from 'react';
import { HelpCircle, Search, Mail, MessageSquare } from 'lucide-react';
import { FAQAccordion, FAQItem } from '../components/FAQAccordion';
import { useApp } from '../context/AppContext';

export const FAQPage: React.FC = () => {
  const { navigate } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const faqs: FAQItem[] = [
    {category:'General',question:'What does BOOYAH STUDIO sell?',answer:'Digital website templates and source-code packages. Read each listing for included files, features, dependencies, and licensing. No physical products are shipped.'},
    {category:'Downloads',question:'When do I receive my files?',answer:'After a verified live payment, download access normally appears in your account within 5 minutes. If delivery is delayed beyond 24 hours, contact connectbooyahstudio@gmail.com with your order ID. A test payment never unlocks paid files.'},
    {category:'Payments',question:'What happens in test mode?',answer:'Test checkout uses sandbox payment methods. You receive a test confirmation email when email is configured, but no product files, download access, or purchase invoice. A test order is not a live purchase.'},
    {category:'Payments',question:'Which payment methods are available?',answer:'Configured Easebuzz and PayU checkout can offer UPI, cards, and netbanking, subject to gateway availability. The checkout shows whether each gateway is in test mode, live, or not yet configured. India checkout uses INR.'},
    {category:'Refunds',question:'Can I request a refund or cancellation?',answer:'Contact support before delivery to request cancellation. Duplicate charges, non-delivery, wrong files, and unresolved material defects may qualify for a refund. Change-of-mind refunds are generally unavailable after delivery. Approved refunds are initiated to the original method within 5–7 working days; bank processing may take longer. Applicable consumer rights remain available.'},
    {category:'Technical',question:'Can I customize the templates?',answer:'Yes, subject to the product license and any third-party licenses. Hosting, backend integrations, and custom development are not included unless the listing says otherwise. Do not redistribute or resell the source package as a competing template.'},
    {category:'Technical',question:'Are future updates included?',answer:'Check the individual product listing for update and support terms. Do not assume a lifetime update commitment unless it is explicitly stated for that product.'},
    {category:'Security',question:'Do you store my card details?',answer:'Payment credentials are entered with your selected gateway. BOOYAH STUDIO does not store full card numbers, CVVs, OTPs, or UPI PINs. Never share these with our support team.'},
    {category:'General',question:'How do I contact support?',answer:'Email connectbooyahstudio@gmail.com or call +91 9208661701. Our contact address is House No. 12, Thakur Niwas, C Block, Shantipuram, Phaphamau, Prayagraj, Uttar Pradesh 211013, India.'},
  ];

  const filteredFaqs = faqs.filter((faq) => {
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    const matchesQuery =
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
          <HelpCircle className="w-3.5 h-3.5" />
          Knowledge Base
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Frequently Asked Questions
        </h1>
        <p className="text-slate-600 text-sm sm:text-base">
          Find answers regarding digital purchases, delivery, version upgrades, and technical support.
        </p>

        {/* Search Bar */}
        <div className="relative max-w-md mx-auto pt-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search FAQs (e.g. download, refund, PHP version)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
          />
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center justify-center gap-2 flex-wrap text-xs">
        {['all', 'Downloads', 'Technical', 'General', 'Refunds'].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl font-semibold transition-colors capitalize ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {cat === 'all' ? 'All Questions' : cat}
          </button>
        ))}
      </div>

      {/* Accordion Component */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        {filteredFaqs.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            No questions match "{searchQuery}". Try another keyword or submit a ticket to our support team.
          </div>
        ) : (
          <FAQAccordion items={filteredFaqs} allowMultiple />
        )}
      </div>

      {/* Still Have Questions CTA */}
      <div className="p-8 rounded-3xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-center space-y-3">
        <h3 className="text-lg font-bold text-slate-900">Still have questions?</h3>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
          Our technical support engineers are on standby to answer any pre-sale architectural or licensing questions.
        </p>
        <button
          onClick={() => navigate('/contact')}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
        >
          Contact Customer Support Desk
        </button>
      </div>
    </div>
  );
};
