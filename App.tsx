import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Welcome from './Welcome';
import Auth from './Auth';
import Profile from './Profile';
import Home from './Home';
import Scanner from './Scanner';
import Evaluation from './Evaluation';
import type { ScreenId } from './types';

export default function App() {
  const [screen, setScreen] = useState<ScreenId>('welcome');
  const [manualScan, setManualScan] = useState(false);
  const go = (s: ScreenId, options?: { scanManual?: boolean }) => {
    setManualScan(s === 'scan' && options?.scanManual === true);
    setScreen(s);
    window.scrollTo(0, 0);
  };
  const content = (() => {
    switch (screen) {
      case 'welcome': return <Welcome go={go} />;
      case 'auth': return <Auth go={go} />;
      case 'profile': return <Profile go={go} />;
      case 'home': return <Home go={go} />;
      case 'scan': return <Scanner go={go} manualOnly={manualScan} />;
      case 'evaluation': return <Evaluation go={go} />;
    }
  })();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={screen}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -24 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="screen-transition"
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
}
