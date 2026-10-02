import { BUSINESS } from '../config/business';
import { Brand } from './Brand';
import React, { useState } from 'react';
import { ArrowRight, Check, Flame } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';

export const Footer: React.FC = () => {
  const { navigate } = useApp();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [pending, setPending] = useState(false);
  const handleSubscribe = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch('/api/newsletter/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error('Subscription failed');
      setSubscribed(true);
      setEmail('');
    } catch {
      showToast('error', 'Could not subscribe', 'Please try again in a moment.');
    } finally { setPending(false); }
  };
  const groups = [
    { title: 'Explore', links: [['Templates', '/products'], ['Your wishlist', '/wishlist'], ['Your account', '/account'], ['Help & FAQs', '/faq']] },
    { title: 'Get to know us', links: [['Our story', '/about'], ['Contact & support', '/contact'], ['Terms & conditions', '/terms'], ['Privacy policy', '/privacy']] },
  ];
  return (
    <footer className="studio-footer"><div className="studio-container"><div className="footer-main"><div className="footer-brand-column"><button className="studio-brand" onClick={() => navigate('/')} aria-label="BOOYAH STUDIO Home"><Brand /></button><p>Thoughtful digital goods.<br />For the things you haven’t built yet.</p><address className="not-italic text-xs leading-6 mt-4">{BUSINESS.address}<br/><a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a><br/><a href={BUSINESS.phoneHref}>{BUSINESS.phone}</a></address><span className="footer-made">A little inspiration. A lot of possibility.</span></div>{groups.map(group => <div className="footer-link-column" key={group.title}><h3>{group.title}</h3>{group.links.map(([label, path]) => <button key={path} onClick={() => navigate(path)}>{label}</button>)}</div>)}<div className="footer-newsletter"><h3>A little good stuff in your inbox.</h3><p>New templates, fresh ideas. Only the good things.</p>{subscribed ? <p className="newsletter-success" role="status"><Check size={17} /> You’re on the list. Stay inspired.</p> : <form onSubmit={handleSubscribe}><label className="sr-only" htmlFor="newsletter-email">Email address</label><input id="newsletter-email" type="email" autoComplete="email" required placeholder="Your email address" value={email} onChange={e => setEmail(e.target.value)} /><button disabled={pending} aria-label={pending ? 'Subscribing' : 'Subscribe to product updates'}>{pending ? '…' : <ArrowRight size={18} />}</button></form>}</div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} BOOYAH STUDIO. Made for your next chapter.</span><div><button onClick={() => navigate('/refund')}>Refunds</button><button onClick={() => navigate('/policies/cancellation')}>Cancellations</button><button onClick={() => navigate('/policies/shipping-delivery')}>Digital delivery</button><button onClick={() => navigate('/policies/grievance')}>Grievance support</button></div></div></div></footer>
  );
};
