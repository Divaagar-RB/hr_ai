import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, UserCheck, UserX, Clock, TrendingUp, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { motion } from 'framer-motion';

const API_BASE_URL = 'http://localhost:5000/api';

function Analytics() {
  const [stats, setStats] = useState({
    total: 0,
    selected: 0,
    rejected: 1, // Mocking some data for visual impact if DB is empty
    pending: 0,
    selectionRate: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/candidates`);
      const candidates = response.data;
      const total = candidates.length;
      const selected = candidates.filter(c => c.status === 'Selected').length;
      const rejected = candidates.filter(c => c.status === 'Rejected').length;
      const pending = candidates.filter(c => c.status === 'Pending').length;
      
      setStats({
        total,
        selected,
        rejected,
        pending,
        selectionRate: total > 0 ? ((selected / total) * 100).toFixed(1) : 0
      });
    } catch (err) {
      console.error("Error fetching analytics:", err);
    }
  };

  const statCards = [
    { label: 'Total Candidates', value: stats.total, icon: Users, color: 'bg-indigo-500', shadow: 'shadow-indigo-200' },
    { label: 'Selected Candidates', value: stats.selected, icon: UserCheck, color: 'bg-emerald-500', shadow: 'shadow-emerald-200' },
    { label: 'Rejections', value: stats.rejected, icon: UserX, color: 'bg-rose-500', shadow: 'shadow-rose-200' },
    { label: 'Selection Rate', value: `${stats.selectionRate}%`, icon: TrendingUp, color: 'bg-amber-500', shadow: 'shadow-amber-200' },
  ];

  return (
    <div className="space-y-10">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className="glass-card p-6 flex items-center gap-5"
          >
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl", stat.color, stat.shadow)}>
              <stat.icon size={28} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Mock Chart Area 1 */}
        <div className="glass-card p-8 min-h-[400px] flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="text-accent" />
              Hiring Pipeline Trend
            </h3>
            <select className="bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold px-3 py-1 text-slate-600 focus:outline-none">
              <option>Last 30 Days</option>
              <option>Last 6 Months</option>
            </select>
          </div>
          
          <div className="flex-1 flex items-end gap-3 pb-4">
            {[40, 70, 55, 90, 65, 80, 45, 100, 75, 85, 60, 95].map((height, i) => (
              <motion.div 
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ delay: 0.5 + i * 0.05, duration: 1 }}
                className={cn(
                  "flex-1 rounded-t-lg transition-all duration-500 hover:brightness-110 cursor-pointer",
                  i === 7 ? "bg-accent" : "bg-slate-200"
                )}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-4 border-t border-slate-50">
            <span>Jan</span>
            <span>Jun</span>
            <span>Dec</span>
          </div>
        </div>

        {/* Mock Chart Area 2 */}
        <div className="glass-card p-8 min-h-[400px] flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <PieChartIcon className="text-primary-500" />
              Candidate Sources
            </h3>
          </div>
          
          <div className="flex-1 flex items-center justify-center relative">
             <div className="w-48 h-48 rounded-full border-[16px] border-slate-100 relative">
               {/* Simplified mock pie sections */}
               <div className="absolute inset-0 rounded-full border-[16px] border-accent border-l-transparent border-b-transparent transform -rotate-45" />
               <div className="absolute inset-0 flex flex-col items-center justify-center">
                 <p className="text-3xl font-black text-slate-900">124</p>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Leads</p>
               </div>
             </div>
          </div>

          <div className="space-y-3 pt-6">
            {[
              { label: 'LinkedIn', value: '45%', color: 'bg-accent' },
              { label: 'Referrals', value: '30%', color: 'bg-emerald-500' },
              { label: 'Job Boards', value: '25%', color: 'bg-slate-200' },
            ].map(source => (
              <div key={source.label} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={cn("w-3 h-3 rounded-full", source.color)} />
                  <span className="font-medium text-slate-600">{source.label}</span>
                </div>
                <span className="font-bold text-slate-900">{source.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper to keep the file self-contained for this implementation
function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}

export default Analytics;
