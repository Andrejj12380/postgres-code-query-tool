
import React from 'react';
import { ViewMode } from '../types';

interface SidebarProps {
  activeView: ViewMode;
  setActiveView: (view: ViewMode) => void;
  onOpenHelp: () => void;
}

const navItems = [
  {
    id: ViewMode.DASHBOARD,
    label: 'Поиск и Отчёты',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: ViewMode.CONNECTIONS,
    label: 'Базы данных',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7a8 3 0 0116 0M4 7v10a8 3 0 0016 0V7M4 12a8 3 0 0016 0" />
      </svg>
    ),
  },
  {
    id: ViewMode.PRODUCTS,
    label: 'Продукция',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
      </svg>
    ),
  },
  {
    id: ViewMode.FIELD_NAMES,
    label: 'Названия полей',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
];

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, onOpenHelp }) => {
  return (
    <div
      className="w-64 flex flex-col shadow-2xl"
      style={{
        background: 'linear-gradient(180deg, #070d1a 0%, #0d1422 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo */}
      <div className="px-6 py-7 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed)' }}
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7a8 3 0 0116 0M4 7v10a8 3 0 0016 0V7M4 12a8 3 0 0016 0" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">Проверка БД</h1>
            <p className="text-[10px] font-medium tracking-widest uppercase" style={{ color: '#00d4ff' }}>
              Query Tool
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1" data-tour="sidebar-nav">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-3 mb-3">
          Разделы
        </p>
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative"
              style={
                isActive
                  ? {
                    background: 'linear-gradient(90deg, rgba(0,212,255,0.18) 0%, rgba(124,58,237,0.12) 100%)',
                    boxShadow: '0 0 16px rgba(0,212,255,0.12)',
                    border: '1px solid rgba(0,212,255,0.25)',
                  }
                  : {
                    background: 'transparent',
                    border: '1px solid transparent',
                  }
              }
            >
              {/* Left accent bar */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                  style={{ background: 'linear-gradient(180deg, #00d4ff, #7c3aed)' }}
                />
              )}
              <span style={{ color: isActive ? '#00d4ff' : '#64748b' }}
                className="transition-colors duration-200 group-hover:text-cyan-400 pl-1">
                {item.icon}
              </span>
              <span
                className="font-medium text-sm transition-colors duration-200"
                style={{ color: isActive ? '#e2e8f0' : '#64748b' }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Help button */}
      <div className="px-3 pb-3">
        <button
          onClick={onOpenHelp}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group"
          style={{ border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="text-slate-600 group-hover:text-cyan-400 transition-colors pl-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          <span className="text-sm font-medium text-slate-600 group-hover:text-slate-300 transition-colors">
            Справка
          </span>
        </button>
      </div>

      {/* Version */}
      <div className="px-6 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[10px] text-slate-700 text-center font-mono">V 2.1.0 · Local Client</p>
      </div>
    </div>
  );
};

export default Sidebar;
