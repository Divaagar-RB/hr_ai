import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, MessageSquare, CheckCircle2, AlertCircle, Loader2, User, Star, ClipboardList, Target } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

import config from '../config';

const API_BASE_URL = config.API_BASE_URL;


function FeedbackUpload({ onComplete }) {
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/candidates`);
      setCandidates(response.data);
    } catch (err) {
      console.error("Error fetching candidates:", err);
    }
  };

  const uploadFeedback = async () => {
    if (!file || !selectedCandidate) return;

    const formData = new FormData();
    formData.append("candidate_id", selectedCandidate);
    formData.append("feedback", file);

    try {
      setUploading(true);
      setError(null);
      const response = await axios.post(`${API_BASE_URL}/upload/feedback`, formData);
      setResult(response.data.interviews);
      toast.success("Feedback processed! Status updated.");
    } catch (err) {
      console.error("Upload failed:", err);
      const msg = err.response?.data?.error || "Failed to extract feedback.";
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {!result ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-6 md:p-12"
        >
          <div className="text-center mb-10">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6 text-primary-600">
              <MessageSquare className="w-8 h-8 md:w-10 md:h-10" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">Upload Interview Feedback</h2>
            <p className="text-sm md:text-base text-slate-500 max-w-md mx-auto">
              Digitize handwritten or typed interview notes. Gemma 3 will extract round details and scores.
            </p>
          </div>

          <div className="space-y-6 md:space-y-8 max-w-md mx-auto">
            <div className="space-y-2">
              <label className="text-xs md:text-sm font-bold text-slate-700 ml-1">Select Candidate</label>
              <select 
                className="input-field appearance-none text-sm"
                value={selectedCandidate}
                onChange={(e) => setSelectedCandidate(e.target.value)}
              >
                <option value="">Choose a candidate...</option>
                {candidates.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs md:text-sm font-bold text-slate-700 ml-1">Feedback Image</label>
              <label className="relative group cursor-pointer block">
                <div className={cn(
                  "px-4 md:px-8 py-8 md:py-10 border-2 border-dashed rounded-2xl transition-all duration-300 text-center",
                  file ? "border-primary-500 bg-primary-50/30" : "border-slate-200 hover:border-primary-400 hover:bg-slate-50"
                )}>
                  <input type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} accept="image/*" />
                  <div className="flex flex-col items-center gap-3 text-slate-400 group-hover:text-primary-500">
                    <Upload className="w-6 h-6 md:w-8 md:h-8" />
                    <span className="text-xs md:text-sm font-medium truncate max-w-full">{file ? file.name : "Click to upload notes image"}</span>
                  </div>
                </div>
              </label>
            </div>

            <button 
              onClick={uploadFeedback}
              disabled={uploading || !file || !selectedCandidate}
              className="btn-primary w-full flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Analyzing with AI...
                </>
              ) : (
                "Extract Feedback"
              )}
            </button>

            {error && (
              <div className="flex items-center gap-2 text-rose-500 text-sm font-medium justify-center">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <CheckCircle2 className="text-emerald-500" size={28} />
              Feedback Extracted ({result.length} Rounds)
            </h2>
            <button onClick={() => setResult(null)} className="btn-secondary text-sm px-4 py-2">
              Upload New
            </button>
          </div>

          <div className="space-y-8">
            {result.map((round, idx) => (
              <div key={idx} className="glass-card overflow-hidden">
                <div className="bg-slate-900 p-6 md:p-8 text-white flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 md:w-12 md:h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                      <Target size={22} className="text-primary-400" />
                    </div>
                    <div>
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Interview Status</p>
                      <p className="text-lg md:text-xl font-bold">{round.status || "Extracted"}</p>
                    </div>
                  </div>
                  <div className="text-center md:text-right">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Round Number</p>
                    <p className="text-lg md:text-xl font-bold">#{round.round_number || 1}</p>
                  </div>
                </div>

                <div className="p-6 md:p-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Star size={18} className="text-amber-400 fill-amber-400" />
                        Round Feedback
                      </h4>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                        {typeof round.feedback === 'string' 
                          ? round.feedback 
                          : (round.feedback?.round_feedback || round.feedback?.remarks || "No specific feedback extracted.")}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <ClipboardList size={18} className="text-indigo-400" />
                        Key Remarks
                      </h4>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-slate-700 text-sm leading-relaxed">
                        {typeof round.feedback === 'object' ? (round.feedback?.remarks || "No supplementary remarks found.") : "See feedback above."}
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100 flex items-center gap-4 text-slate-600">
                    <User size={18} />
                    <span className="text-sm font-medium">Interviewer: <span className="text-slate-900 font-bold">{round.interviewer || "Unknown"}</span></span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button onClick={() => onComplete({id: selectedCandidate})} className="btn-primary bg-accent hover:bg-accent-dark">
              Show Updated Profile
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default FeedbackUpload;
