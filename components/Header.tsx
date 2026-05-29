import React, { useState, useEffect } from 'react';
import { Menu, X, Leaf } from 'lucide-react';

interface HeaderProps {
  currentPage?: 'home' | 'diet-plan' | 'admin';
}

const Header: React.FC<HeaderProps> = ({ currentPage = 'home' }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isSolid = isScrolled || currentPage === 'diet-plan' || currentPage === 'admin';
  const isAdminWorkspace =
    currentPage === 'admin' || currentPage === 'diet-plan';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Services', href: '#services' },
    { name: 'BMI Calculator', href: '#bmi' },
    { name: 'Healthy Games', href: '#healthy-games' },
    { name: 'AI Assistant', href: '#ai-assistant' },
    { name: 'Testimonials', href: '#testimonials' },
    { name: 'Contact', href: '#contact' },
  ];

  return (
    <header 
      className={`fixed w-full z-50 transition-all duration-300 ${
        isSolid ? 'bg-white shadow-md py-3' : 'bg-transparent py-5'
      }`}
    >
      <div className="container mx-auto px-6 flex justify-between items-center">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2 group">
          <div className="bg-leaf-600 p-2 rounded-full text-white group-hover:bg-leaf-700 transition-colors">
            <Leaf size={24} />
          </div>
          <span className={`font-serif text-2xl font-bold tracking-tight ${isSolid ? 'text-slate-800' : 'text-slate-800 lg:text-slate-900'}`}>
            NutriGuide
          </span>
        </a>

        {/* Desktop Nav */}
        {!isAdminWorkspace && (
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <a 
              key={link.name} 
              href={link.href}
              className={`text-sm font-medium hover:text-leaf-600 transition-colors ${
                isSolid ? 'text-slate-600' : 'text-slate-700'
              }`}
            >
              {link.name}
            </a>
          ))}
        </nav>
        )}

        {/* Mobile Menu Button */}
        {!isAdminWorkspace && (
        <button 
          className="md:hidden text-slate-700 p-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        )}
      </div>

      {/* Mobile Nav */}
      {isMobileMenuOpen && !isAdminWorkspace && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white shadow-xl border-t border-slate-100 p-6 flex flex-col gap-4 animate-in slide-in-from-top-5">
          {navLinks.map((link) => (
            <a 
              key={link.name} 
              href={link.href}
              className="text-slate-700 font-medium py-2 border-b border-slate-50 hover:text-leaf-600"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {link.name}
            </a>
          ))}
        </div>
      )}
    </header>
  );
};

export default Header;
