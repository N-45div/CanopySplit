import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import Landing from '@/pages/Home';
import AppPage from '@/pages/AppPage';
import Hooks from '@/pages/Hooks';
import { Toaster } from '@/components/ui/sonner';
import './App.css';

function HashScroll() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [hash]);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <HashScroll />
      <Routes>
        <Route index element={<Landing />} />
        <Route path="app" element={<AppPage />} />
        <Route path="hooks" element={<Hooks />} />
      </Routes>
      <Footer />
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
