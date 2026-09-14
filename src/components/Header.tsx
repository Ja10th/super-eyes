import React from 'react';
import { PlatformView } from '../types';
import {
  Film,
  Calendar,
  Eye,
  Radio,
  Image,
} from 'lucide-react';

interface HeaderProps {
  currentView: PlatformView;
  onSelectView: (view: PlatformView) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onSelectView,
}) => {
  const navItems: { id: PlatformView; label: string; icon: React.ReactNode }[] = [
    { id: 'studio', label: 'studio', icon: <Film className="w-3.5 h-3.5" /> },
    { id: 'queue', label: 'library', icon: <Calendar className="w-3.5 h-3.5" /> },
    { id: 'automation', label: 'automations', icon: <Radio className="w-3.5 h-3.5" /> },
    { id: 'youtube', label: 'channels', icon: <Eye className="w-3.5 h-3.5" /> },
    { id: 'thumbnails', label: 'thumbnails', icon: <Image className="w-3.5 h-3.5" /> },
  ];

  return (
    <>
      <header className="aiv2-nav">
        <nav className="aiv2-nav-list">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`aiv2-nav-link ${isActive ? 'is-active' : ''}`
                }
              >
                <span className="aiv2-nav-number">0{navItems.indexOf(item) + 1}</span>
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </header>
      <div className="aiv2-brand"><Eye className="w-4 h-4" /><span>ZEN<br />VISION</span></div>
    </>
);
};
