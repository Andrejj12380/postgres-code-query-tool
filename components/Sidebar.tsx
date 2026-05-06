
import React from 'react';
import { ViewMode } from '../types';

interface SidebarProps {
  activeView: ViewMode;
  setActiveView: (view: ViewMode) => void;
  onOpenHelp: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, onOpenHelp }) => {
  const navItems = [
    { id: ViewMode.DASHBOARD, label: 'Поиск и Отчеты', icon: '📊' },
    { id: ViewMode.PRINT, label: 'Печать', icon: '🖨️' },
    { id: ViewMode.CONNECTIONS, label: 'Базы данных', icon: '🔌' },
    { id: ViewMode.PRODUCTS, label: 'Продукция', icon: '📦' },
    { id: ViewMode.FIELD_NAMES, label: 'Названия полей', icon: '🏷️' },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col shadow-xl">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold tracking-tight">MarkView</h1>
        <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">Отображение отчёта</p>
      </div>
      <nav className="flex-1 mt-4 px-2 space-y-1" data-tour="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${activeView === item.id
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="px-2 pb-2">
        <button
          onClick={onOpenHelp}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-all duration-200"
        >
          <span className="text-xl">❓</span>
          <span className="font-medium">Справка</span>
        </button>
      </div>
      <div className="p-4 border-t border-slate-800">
        <div className="text-[10px] text-slate-500 text-center">
          V 2.1.0 (Local Client)
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
