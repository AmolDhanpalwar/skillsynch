import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const container = document.querySelector('main');
    if (!container) return;

    function handleScroll() {
      setVisible((container as HTMLElement).scrollTop > 300);
    }

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  function scrollToTop() {
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <button
      onClick={scrollToTop}
      aria-label="Back to top"
      className={`
        fixed bottom-20 right-5 z-40 w-10 h-10 rounded-full
        bg-primary-500 text-white shadow-md shadow-primary-900/20
        flex items-center justify-center
        transition-all duration-300
        hover:bg-primary-600 hover:shadow-lg hover:scale-110 active:scale-95
        ${visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}
      `}
    >
      <ArrowUp size={16} />
    </button>
  );
}
