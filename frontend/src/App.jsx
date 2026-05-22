import React, { useState } from 'react';
import { LayoutDashboard, UserPlus, MessageSquare, PieChart, Menu, X, Rocket } from 'lucide-react';
import Dashboard from './components/Dashboard';
import ResumeUpload from './components/ResumeUpload';
import FeedbackUpload from './components/FeedbackUpload';
import UnifiedUpload from './components/UnifiedUpload';
import Analytics from './components/Analytics';
import { cn } from './lib/utils';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'resume', label: 'Resume Upload', icon: UserPlus },
    { id: 'feedback', label: 'Interview Feedback', icon: MessageSquare },
    { id: 'unified', label: 'Unified Digitize', icon: Rocket },
    { id: 'analytics', label: 'Hiring Insights', icon: PieChart },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile Sidebar Overlay */}
      <div 
        className={cn(
          "fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 transition-opacity duration-300 lg:hidden",
          isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:block",
          !isSidebarOpen && "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-white shadow-lg shadow-accent/20">
              <Rocket size={24} />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-accent to-primary-600">
              HireAI
            </span>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                  activeTab === item.id 
                    ? "bg-accent/10 text-accent" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <item.icon size={20} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-100">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-4 rounded-2xl text-white">
              <p className="text-xs font-medium text-slate-400 mb-1">Current Model</p>
              <p className="text-sm font-bold flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Gemma 3 (Local)
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white/70 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-slate-500 lg:hidden"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 truncate">
              {navItems.find(t => t.id === activeTab)?.label}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200" />
            </button>
          </div>
        </header>

        <section className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'resume' && <ResumeUpload onComplete={() => setActiveTab('dashboard')} />}
            {activeTab === 'feedback' && <FeedbackUpload onComplete={() => setActiveTab('dashboard')} />}
            {activeTab === 'unified' && <UnifiedUpload onComplete={() => setActiveTab('dashboard')} />}
            {activeTab === 'analytics' && <Analytics />}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
