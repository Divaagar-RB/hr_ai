import React, { useState } from 'react';
import axios from 'axios';
import { Upload, FileText, MessageSquare, CheckCircle2, AlertCircle, Loader2, Sparkles, User, Target } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

import config from '../config';

const API_BASE_URL = config.API_BASE_URL;


function UnifiedUpload({ onComplete }) {
  const [resumeFile, setResumeFile] = useState(null);
  const [feedbackFile, setFeedbackFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleUpload = async () => {
    if (!resumeFile || !feedbackFile) return;

    const formData = new FormData();
    formData.append("files", resumeFile);
    formData.append("files", feedbackFile);

    try {
      setUploading(true);
      setError(null);
      const response = await axios.post(`${API_BASE_URL}/upload/unified`, formData);
      setResult(response.data);
      toast.success("Extraction complete! Profile updated.");
    } catch (err) {
      console.error("Unified upload failed:", err);
      const msg = err.response?.data?.error || "Failed to process extraction.";
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {!result ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 md:p-12"
        >
          <div className="text-center mb-10">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-tr from-accent to-primary-400 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white shadow-xl shadow-accent/20">
              <Sparkles className="w-8 h-8 md:w-10 md:h-10" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">Unified Digitization</h2>
            <p className="text-sm md:text-base text-slate-500 max-w-lg mx-auto">
              Simultaneously process a candidate's resume and their latest interview feedback to update your HR records in one click.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Resume Dropzone */}
            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2 ml-1">
                <FileText size={18} className="text-accent" />
                Step 1: Upload Resume
              </label>
              <label className="relative group cursor-pointer block">
                <div className={cn(
                  "px-8 py-12 border-2 border-dashed rounded-3xl transition-all duration-300 text-center",
                  resumeFile ? "border-accent bg-accent/5" : "border-slate-200 hover:border-accent hover:bg-slate-50"
                )}>
                  <input type="file" className="hidden" onChange={(e) => setResumeFile(e.target.files[0])} accept="image/*,application/pdf" />
                  <div className="flex flex-col items-center gap-3 text-slate-400 group-hover:text-accent">
                    <Upload size={32} />
                    <span className="text-sm font-bold">{resumeFile ? resumeFile.name : "Select Resume Image"}</span>
                  </div>
                </div>
              </label>
            </div>

            {/* Feedback Dropzone */}
            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2 ml-1">
                <MessageSquare size={18} className="text-primary-500" />
                Step 2: Upload Feedback
              </label>
              <label className="relative group cursor-pointer block">
                <div className={cn(
                  "px-8 py-12 border-2 border-dashed rounded-3xl transition-all duration-300 text-center",
                  feedbackFile ? "border-primary-500 bg-primary-50/30" : "border-slate-200 hover:border-primary-400 hover:bg-slate-50"
                )}>
                  <input type="file" className="hidden" onChange={(e) => setFeedbackFile(e.target.files[0])} accept="image/*" />
                  <div className="flex flex-col items-center gap-3 text-slate-400 group-hover:text-primary-500">
                    <Upload size={32} />
                    <span className="text-sm font-bold">{feedbackFile ? feedbackFile.name : "Select Feedback Image"}</span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center gap-6">
            <button 
              onClick={handleUpload}
              disabled={uploading || !resumeFile || !feedbackFile}
              className="btn-primary min-w-[300px] py-4 text-lg flex items-center gap-3 justify-center disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin" size={24} />
                  AI Processing Pipeline...
                </>
              ) : (
                <>
                  <Sparkles size={24} />
                  Digitize Candidate Profile
                </>
              )}
            </button>

            {error && (
              <div className="flex items-center gap-2 text-rose-500 text-sm font-bold">
                <AlertCircle size={18} />
                {error}
              </div>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-6 md:space-y-8"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white p-5 md:p-6 rounded-2xl border border-slate-200 gap-4">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 md:w-12 md:h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-bold text-slate-900">Successfully Processed</h2>
                <p className="text-xs md:text-sm text-slate-500">Candidate profile created and interview status updated.</p>
              </div>
            </div>
            <button onClick={() => setResult(null)} className="btn-secondary w-full md:w-auto text-sm">
              Upload New Pair
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             {/* Candidate Info Card */}
             <div className="glass-card p-6 md:p-10 space-y-6">
                <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Candidate Profile</h3>
                <div className="flex items-center gap-4 md:gap-6">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-accent rounded-2xl md:rounded-3xl flex items-center justify-center text-white text-2xl md:text-3xl font-black shrink-0">
                    {result.candidate.name?.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xl md:text-2xl font-bold text-slate-900 truncate">{result.candidate.name}</h4>
                    <span className="px-2.5 py-0.5 bg-accent/10 text-accent rounded-full text-[10px] md:text-xs font-black uppercase tracking-wider mt-2 inline-block">
                      {result.candidate.status}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 pt-6 border-t border-slate-100">
                  <div className="min-w-0">
                    <p className="text-[10px] md:text-xs font-bold text-slate-400 mb-1">Email</p>
                    <p className="text-xs md:text-sm font-medium text-slate-700 truncate">{result.candidate.email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] md:text-xs font-bold text-slate-400 mb-1">Phone</p>
                    <p className="text-xs md:text-sm font-medium text-slate-700">{result.candidate.phone}</p>
                  </div>
                </div>
             </div>

             {/* Interview Feedback List */}
             <div className="lg:col-span-1 space-y-6">
                <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Interview Feedback ({result.interviews.length} Rounds)</h3>
                <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {result.interviews.map((round, idx) => (
                    <div key={idx} className="glass-card p-0 overflow-hidden flex flex-col border-primary-100/50 border-2">
                       <div className="bg-slate-900 p-6 text-white">
                         <div className="flex justify-between items-center">
                           <div>
                             <p className="text-slate-400 text-[10px] font-bold mb-1 uppercase tracking-tight">Round #{round.round_number}</p>
                             <p className="text-lg font-black text-primary-400 leading-none">{round.status || "Extracted"}</p>
                           </div>
                           <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                             <Target size={16} className="text-primary-400" />
                           </div>
                         </div>
                       </div>
                       <div className="p-6 space-y-4">
                          <div>
                             <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Remarks</p>
                             <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-slate-600 text-xs italic">
                               "{typeof round.feedback === 'string' ? round.feedback : (round.feedback?.remarks || round.feedback?.round_feedback || "None")}"
                             </div>
                          </div>
                          <div className="flex items-center gap-2 text-slate-500 text-xs">
                             <User size={12} />
                             <span className="font-medium">Interviewer: {round.interviewer || "Unknown"}</span>
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
             </div>
          </div>

          <div className="flex justify-center">
            <button onClick={() => onComplete(result.candidate)} className="btn-primary min-w-[200px]">
              Show Full Profile
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default UnifiedUpload;
