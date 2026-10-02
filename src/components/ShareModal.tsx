import React, { useState } from 'react';
import { Copy, Check, Share2, MessageCircle, Twitter, Facebook, Linkedin, X } from 'lucide-react';
import { Modal } from './Modal';
import { useToast } from '../context/ToastContext';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  path: string; // e.g., '/product/focus-week' or '/about'
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  path,
}) => {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  // Clean canonical URL without tracking or session parameters
  const cleanPath = path.split('?')[0].replace(/\/$/, '') || '/';
  const cleanCanonicalUrl = `https://www.booyahstudio.shop${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`;

  const hasNativeShare = typeof navigator !== 'undefined' && Boolean(navigator.share);

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title,
        text: description,
        url: cleanCanonicalUrl,
      });
      showToast('success', 'Shared successfully', 'Thank you for sharing!');
      onClose();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      showToast('error', 'Sharing failed', 'Unable to complete native share.');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanCanonicalUrl);
      setCopied(true);
      showToast('success', 'Link copied', 'Clean URL copied to clipboard.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('error', 'Copy failed', 'Could not copy link to clipboard.');
    }
  };

  const shareOptions = [
    {
      name: 'WhatsApp',
      icon: MessageCircle,
      color: 'bg-emerald-500 hover:bg-emerald-600 text-white',
      url: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${title}\n${cleanCanonicalUrl}`)}`,
    },
    {
      name: 'X (Twitter)',
      icon: Twitter,
      color: 'bg-slate-900 hover:bg-black text-white',
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(cleanCanonicalUrl)}`,
    },
    {
      name: 'Facebook',
      icon: Facebook,
      color: 'bg-blue-600 hover:bg-blue-700 text-white',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(cleanCanonicalUrl)}`,
    },
    {
      name: 'LinkedIn',
      icon: Linkedin,
      color: 'bg-sky-700 hover:bg-sky-800 text-white',
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(cleanCanonicalUrl)}`,
    },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="md">
      <div className="space-y-5 p-1">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Share This Item</h3>
              <p className="text-xs text-slate-500 truncate max-w-xs">{title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            aria-label="Close share window"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Native Web Share Button if supported */}
        {hasNativeShare && (
          <button
            onClick={handleNativeShare}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            <Share2 className="w-4 h-4" />
            <span>Use Device Native Share Menu</span>
          </button>
        )}

        {/* Platform Share Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {shareOptions.map((opt) => {
            const Icon = opt.icon;
            return (
              <a
                key={opt.name}
                href={opt.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  showToast('success', 'Opening Share', `Opening ${opt.name}...`);
                }}
                className={`flex flex-col items-center justify-center p-3.5 rounded-2xl ${opt.color} transition-all shadow-xs hover:scale-102 active:scale-98`}
              >
                <Icon className="w-5 h-5 mb-1.5" />
                <span className="text-[11px] font-bold">{opt.name}</span>
              </a>
            );
          })}
        </div>

        {/* Copy Link Input Section */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-bold text-slate-700 block">Clean Canonical URL</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={cleanCanonicalUrl}
              className="flex-1 px-3.5 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 select-all focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center gap-1.5 shrink-0 ${
                copied
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
