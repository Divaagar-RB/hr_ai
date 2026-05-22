import React, { useState } from 'react';
import axios from 'axios';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, User, Mail, Phone, Code, GraduationCap, Briefcase, Award } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

const API_BASE_URL = 'http://localhost:5000/api';

function ResumeUpload({ onComplete }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const uploadResume = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("resume", file);

    try {
      setUploading(true);
      setError(null);
      const response = await axios.post(`${API_BASE_URL}/upload/resume`, formData);
      setResult(response.data.candidate);
      toast.success("Resume processed! Candidate added.");
    } catch (err) {
      console.error("Upload failed:", err);
      const msg = err.response?.data?.error || "Failed to extract details.";
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
          className="glass-card p-6 md:p-12 text-center"
        >
          <div className="w-16 h-16 md:w-20 md:h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6 text-accent">
            <Upload className="w-8 h-8 md:w-10 md:h-10" />
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">Upload Candidate Resume</h2>
          <p className="text-sm md:text-base text-slate-500 mb-8 max-w-md mx-auto">
            Upload a resume image or PDF. Our AI (Gemma 3) will automatically extract candidate details.
          </p>

          <div className="flex flex-col items-center gap-6">
            <label className="relative group cursor-pointer w-full max-w-xs">
              <div className={cn(
                "px-4 md:px-8 py-4 border-2 border-dashed rounded-2xl transition-all duration-300",
                file ? "border-accent bg-accent/5" : "border-slate-200 hover:border-accent hover:bg-slate-50"
              )}>
                <input type="file" className="hidden" onChange={handleFileChange} accept="image/*,application/pdf" />
                <div className="flex items-center justify-center gap-3 text-slate-600 group-hover:text-accent font-medium text-sm">
                  <FileText size={18} />
                  <span className="truncate max-w-[150px]">{file ? file.name : "Click to select a file"}</span>
                </div>
              </div>
            </label>

            {file && (
              <button 
                onClick={uploadResume}
                disabled={uploading}
                className="btn-primary flex items-center gap-2 min-w-[200px] justify-center"
              >
                {uploading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Processing...
                  </>
                ) : (
                  "Start AI Extraction"
                )}
              </button>
            )}

            {error && (
              <div className="flex items-center gap-2 text-rose-500 text-sm font-medium animate-shake">
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
              Extraction Complete
            </h2>
            <button onClick={() => setResult(null)} className="btn-secondary text-sm px-4 py-2">
              Upload Another
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Candidate Card */}
            <div className="glass-card p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-accent flex items-center justify-center text-white text-xl md:text-2xl font-bold uppercase shrink-0">
                  {result.name?.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-slate-900 leading-tight">{result.name}</h3>
                  <p className="text-slate-500 text-xs md:text-sm">{result.status}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4 text-slate-600 truncate">
                  <Mail size={16} className="text-accent shrink-0" />
                  <span className="text-xs md:text-sm font-medium truncate">{result.email}</span>
                </div>
                <div className="flex items-center gap-4 text-slate-600">
                  <Phone size={16} className="text-accent shrink-0" />
                  <span className="text-xs md:text-sm font-medium">{result.phone}</span>
                </div>
              </div>
              
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Code size={14} /> Skills
                </h4>
                <div className="flex flex-wrap gap-2">
                  {result.skills?.map(skill => (
                    <span key={skill} className="px-3 py-1 bg-accent/5 text-accent rounded-lg text-xs font-bold border border-accent/10">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Professional Details */}
            <div className="glass-card p-8 space-y-8">
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <GraduationCap size={14} /> Education
                </h4>
                <p className="text-sm text-slate-700 leading-relaxed font-medium">{result.education}</p>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Briefcase size={14} /> Experience
                </h4>
                <p className="text-sm text-slate-700 leading-relaxed">{result.experience}</p>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Award size={14} /> Certifications
                </h4>
                <p className="text-sm text-slate-700 leading-relaxed italic">{result.certifications || "None extracted"}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button onClick={() => onComplete(result)} className="btn-primary bg-slate-900 hover:bg-slate-800">
              Show Details
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default ResumeUpload;
