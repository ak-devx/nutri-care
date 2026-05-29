import React, { useEffect, useState } from 'react';
import { BMIResult } from './types';
import Header from './components/Header';
import Hero from './components/Hero';
const Services = React.lazy(() => import('./components/Services'));
const BMICalculator = React.lazy(() => import('./components/BMICalculator'));
const HealthyGames = React.lazy(() => import('./components/HealthyGames'));
const AIAssistant = React.lazy(() => import('./components/AIAssistant'));
const SocialPresence = React.lazy(() => import('./components/SocialPresence'));
const Testimonials = React.lazy(() => import('./components/Testimonials'));
const Contact = React.lazy(() => import('./components/Contact'));
const Footer = React.lazy(() => import('./components/Footer'));
const DietPlanCreator = React.lazy(() => import('./components/DietPlanCreator'));
const AdminPanel = React.lazy(() => import('./components/AdminPanel'));

const App: React.FC = () => {
  const [bmiResult, setBmiResult] = useState<BMIResult | null>(null);
  const [currentHash, setCurrentHash] = useState(() => window.location.hash);

  useEffect(() => {
    const handleHashChange = () => setCurrentHash(window.location.hash);

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (
      !currentHash ||
      currentHash === '#' ||
      currentHash === '#/diet-plan' ||
      currentHash === '#/admin' ||
      currentHash === '#/admin/clients/new' ||
      currentHash.startsWith('#/admin/clients/')
    ) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    window.setTimeout(() => {
      document
        .getElementById(currentHash.replace('#', ''))
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, [currentHash]);

  const isDietPlanPage = currentHash === '#/diet-plan';
  const isAdminPage =
    currentHash === '#/admin' ||
    currentHash === '#/admin/clients/new' ||
    currentHash.startsWith('#/admin/clients/');

  return (
    <div className="min-h-screen font-sans selection:bg-leaf-200 selection:text-leaf-900">
      <Header
        currentPage={isDietPlanPage ? 'diet-plan' : isAdminPage ? 'admin' : 'home'}
      />
      <React.Suspense fallback={
        <div className="flex min-h-screen items-center justify-center p-20">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-leaf-600"></div>
        </div>
      }>
        {isAdminPage ? (
          <AdminPanel currentHash={currentHash} />
        ) : isDietPlanPage ? (
          <DietPlanCreator />
        ) : (
          <main>
            <Hero />
            <Services />
            <BMICalculator onBMIChange={setBmiResult} />
            <HealthyGames />
            <AIAssistant bmiResult={bmiResult} />
            <SocialPresence />
            <Testimonials />
            <Contact />
          </main>
        )}
      </React.Suspense>
      <React.Suspense fallback={null}>
        <Footer />
      </React.Suspense>
    </div>
  );
};

export default App;
