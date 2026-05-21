import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Filter, Mail, Phone, Calendar, ChevronRight, MoreVertical, BadgeCheck, BadgeAlert, BadgeInfo } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

const API_BASE_URL = 'http://localhost:5000/api';

function Dashboard() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/candidates`);
      setCandidates(response.data);
    } catch (err) {
      console.error("Error fetching candidates:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCandidates = candidates.filter(c => {
    const matchesSearch = c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'All' || c.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Selected': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Rejected': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'Interviewing': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Search candidates by name or email..."
            className="input-field pl-12"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {['All', 'Pending', 'Interviewing', 'Selected', 'Rejected'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                  filterStatus === status 
                    ? "bg-accent text-white shadow-md shadow-accent/20" 
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Candidates List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
          </div>
        ) : filteredCandidates.length > 0 ? (
          filteredCandidates.map((candidate, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={candidate.id}
              className="glass-card p-6 flex flex-col md:flex-row items-center gap-6 hover:shadow-2xl transition-all duration-500 group"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-primary-400/20 flex items-center justify-center text-accent font-bold text-2xl border border-accent/10">
                {candidate.name?.charAt(0)}
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-accent transition-colors">{candidate.name}</h3>
                  <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold border", getStatusStyle(candidate.status))}>
                    {candidate.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5"><Mail size={16} /> {candidate.email}</span>
                  <span className="flex items-center gap-1.5"><Phone size={16} /> {candidate.phone}</span>
                  <span className="flex items-center gap-1.5"><Calendar size={16} /> {new Date(candidate.created_at).toLocaleDateString()}</span>
                </div>
                <div className="pt-2 flex flex-wrap gap-2">
                  {candidate.skills?.map(skill => (
                    <span key={skill} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[11px] font-semibold uppercase tracking-wider">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                  <ChevronRight size={24} />
                </button>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="glass-card p-12 text-center">
            <p className="text-slate-400 font-medium">No candidates found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
