import React from 'react';
import { Leaf, Instagram, Phone } from 'lucide-react';

const WHATSAPP_NUMBER = '919211891504';
const CONTACT_NUMBER = '+91 92118 91504';

const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-1 md:col-span-2">
            <a href="#" className="flex items-center gap-2 mb-4 group text-white">
              <div className="bg-leaf-600 p-2 rounded-full text-white">
                <Leaf size={20} />
              </div>
              <span className="font-serif text-2xl font-bold">NutriGuide</span>
            </a>
            <p className="max-w-sm mb-6">
              Empowering you to live a healthier, happier life through personalized nutrition and science-backed advice.
            </p>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li><a href="#services" className="hover:text-leaf-500 transition-colors">Services</a></li>
              <li><a href="#bmi" className="hover:text-leaf-500 transition-colors">BMI Calculator</a></li>
              <li><a href="#testimonials" className="hover:text-leaf-500 transition-colors">Success Stories</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-4">Legal</h4>
            <ul className="space-y-2">
              <li><a href="#" className="hover:text-leaf-500 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-leaf-500 transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-leaf-500 transition-colors">Cookie Policy</a></li>
            </ul>
          </div>
        </div>

        <div className="mb-10 grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-950 px-6 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-white font-semibold">Call or WhatsApp</p>
              <p className="text-sm text-slate-400">For consultations and diet plan enquiries.</p>
            </div>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-leaf-400 hover:text-leaf-300 transition-colors font-semibold"
            >
              <Phone size={18} />
              {CONTACT_NUMBER}
            </a>
          </div>

          <div className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-950 px-6 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-white font-semibold">Follow Dietitian Iram on Instagram</p>
              <p className="text-sm text-slate-400">Watch nutrition reels, practical health tips, and everyday meal guidance.</p>
            </div>
            <a
              href="https://www.instagram.com/dietitian__iram/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-pink-400 hover:text-pink-300 transition-colors font-semibold"
            >
              <Instagram size={18} />
              @dietitian__iram
            </a>
          </div>
        </div>
        
        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center text-sm">
          <p>&copy; {new Date().getFullYear()} NutriGuide. All rights reserved.</p>
          <p className="mt-2 md:mt-0">Designed with ❤️ for better health.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
