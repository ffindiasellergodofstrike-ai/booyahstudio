import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '6xl';
  mobileFullscreen?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md',
  mobileFullscreen = false,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '6xl': 'max-w-6xl',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          id="modal-overlay"
          className={`fixed inset-0 z-50 flex items-center justify-center overflow-y-auto ${
            mobileFullscreen ? 'p-0 sm:p-6' : 'p-4 sm:p-6'
          }`}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            aria-hidden="true"
          />

          {/* Dialog Container */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            className={`relative w-full ${maxWidthClasses[maxWidth]} bg-white shadow-2xl border border-slate-200 z-10 overflow-hidden my-auto flex flex-col ${
              mobileFullscreen
                ? 'h-[100dvh] rounded-none max-h-[100dvh] sm:h-auto sm:rounded-2xl sm:max-h-[calc(100dvh-3rem)]'
                : 'rounded-2xl max-h-[calc(100dvh-2rem)]'
            }`}
          >
            {/* Header */}
            {title && (
              <div className={`grid grid-cols-[minmax(0,1fr)_auto] gap-3 sm:flex sm:justify-between sm:gap-4 items-center border-b border-slate-100 bg-slate-50/50 shrink-0 ${
                mobileFullscreen ? 'px-4 py-3 sm:px-6 sm:py-4' : 'px-6 py-4'
              }`}>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">{title}</h3>
                </div>
                <button
                  id="modal-close-btn"
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px]"
                  aria-label="Close dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Content */}
            <div className={`overflow-y-auto flex-1 ${mobileFullscreen ? 'p-3 sm:p-6' : 'p-6'}`}>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
