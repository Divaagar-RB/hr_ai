import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { X, User, Save, Loader2, MessageSquare, FileText, MapPin, Link2, Award, GraduationCap, Briefcase } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

import config from '../config';

const API_BASE_URL = config.API_BASE_URL;


function CandidateModal({ candidateId, onClose, onUpdate }) {
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});

  const fetchCandidateDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/candidates/${candidateId}`);
      setCandidate(response.data);
      setFormData(response.data);
    } catch (err) {
      console.error("Error fetching candidate details:", err);
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    if (candidateId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchCandidateDetails();
    }
  }, [candidateId, fetchCandidateDetails]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSkillsChange = (e) => {
    const skills = e.target.value.split(',').map(s => s.trim());
    setFormData(prev => ({ ...prev, skills }));
  };

  // Safely render education (array of objects OR plain string from old data)
  const renderEducation = (education) => {
    if (!education) return <p className="text-slate-400 text-sm italic">Not provided</p>;
    const items = Array.isArray(education) ? education : [education];
    return (
      <div className="space-y-3">
        {items.map((edu, i) => {
          if (typeof edu === 'string') {
            return <p key={i} className="text-slate-700 text-sm leading-relaxed">{edu}</p>;
          }
          return (
            <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              {edu.degree     && <p className="text-sm font-semibold text-slate-900">{edu.degree}</p>}
              {edu.institution&& <p className="text-sm text-slate-600">{edu.institution}</p>}
              <div className="flex gap-4 mt-1">
                {edu.graduation_year && <span className="text-xs text-slate-400">{edu.graduation_year}</span>}
                {edu.cgpa           && <span className="text-xs text-accent font-bold">CGPA {edu.cgpa}</span>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Safely render experience (array of objects OR plain string)
  const renderExperience = (experience) => {
    if (!experience) return <p className="text-slate-400 text-sm italic">Not provided</p>;
    const items = Array.isArray(experience) ? experience : [experience];
    return (
      <div className="space-y-3">
        {items.map((exp, i) => {
          if (typeof exp === 'string') {
            return <p key={i} className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">{exp}</p>;
          }
          return (
            <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              {exp.role    && <p className="text-sm font-semibold text-slate-900">{exp.role}</p>}
              {exp.company && <p className="text-sm text-slate-600">{exp.company}</p>}
              <div className="flex gap-4 mt-1">
                {exp.start_date && <span className="text-xs text-slate-400">{exp.start_date}</span>}
                {exp.end_date   && <span className="text-xs text-slate-400">→ {exp.end_date}</span>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Safely render certifications (array OR string)
  const renderCertifications = (certifications) => {
    if (!certifications) return <p className="text-slate-400 text-sm italic">None</p>;
    const items = Array.isArray(certifications) ? certifications
      : typeof certifications === 'string' ? certifications.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    if (items.length === 0) return <p className="text-slate-400 text-sm italic">None</p>;
    return (
      <div className="flex flex-wrap gap-2">
        {items.map((cert, i) => (
          <span key={i} className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg text-xs font-bold">
            <Award size={10} className="inline mr-1" />{cert}
          </span>
        ))}
      </div>
    );
  };

  const saveChanges = async () => {
    try {
      setSaving(true);
      await axios.patch(`${API_BASE_URL}/candidates/${candidateId}`, formData);
      await fetchCandidateDetails();
      setEditMode(false);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("Error saving candidate details:", err);
    } finally {
      setSaving(false);
    }
  };

  const updateInterview = async (interviewId, field, value) => {
    try {
      await axios.patch(`${API_BASE_URL}/candidates/interviews/${interviewId}`, { [field]: value });
      fetchCandidateDetails();
    } catch (err) {
      console.error("Error updating interview:", err);
    }
  };

  if (!candidate && loading) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent font-bold text-xl uppercase">
              {candidate?.name?.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{candidate?.name}</h2>
              <p className="text-sm text-slate-500">Candidate Details & Feedback</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editMode ? (
              <button 
                onClick={() => setEditMode(true)}
                className="px-4 py-2 text-sm font-bold text-accent hover:bg-accent/5 rounded-xl transition-all"
              >
                Edit Information
              </button>
            ) : (
              <button 
                onClick={saveChanges}
                disabled={saving}
                className="btn-primary py-2 px-6 flex items-center gap-2"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Save
              </button>
            )}
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-all">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
          {loading && !candidate ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-accent" size={40} />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Basic Info */}
                <div className="space-y-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <User size={14} /> Basic Information
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Full Name</label>
                      {editMode ? (
                        <input name="name" value={formData.name || ''} onChange={handleInputChange} className="input-field py-2" />
                      ) : (
                        <p className="text-slate-900 font-medium px-1">{candidate?.name}</p>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Email</label>
                        {editMode ? (
                          <input name="email" value={formData.email || ''} onChange={handleInputChange} className="input-field py-2" />
                        ) : (
                          <p className="text-slate-900 font-medium px-1 truncate text-sm">{candidate?.email || '—'}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Phone</label>
                        {editMode ? (
                          <input name="phone" value={formData.phone || ''} onChange={handleInputChange} className="input-field py-2" />
                        ) : (
                          <p className="text-slate-900 font-medium px-1 text-sm">{candidate?.phone || '—'}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-400 uppercase ml-1 flex items-center gap-1"><MapPin size={10}/>Location</label>
                        {editMode ? (
                          <input name="location" value={formData.location || ''} onChange={handleInputChange} className="input-field py-2" />
                        ) : (
                          <p className="text-slate-700 text-sm px-1">{candidate?.location || '—'}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-400 uppercase ml-1 flex items-center gap-1"><Link2 size={10}/>LinkedIn</label>
                        {editMode ? (
                          <input name="linkedin" value={formData.linkedin || ''} onChange={handleInputChange} className="input-field py-2" />
                        ) : candidate?.linkedin ? (
                          <a href={candidate.linkedin} target="_blank" rel="noopener noreferrer" className="text-accent text-xs underline px-1 break-all">{candidate.linkedin}</a>
                        ) : (
                          <p className="text-slate-400 text-sm px-1">—</p>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 flex flex-wrap gap-2">
                      <div className="w-full">
                        <label className="text-[11px] font-bold text-slate-400 uppercase ml-1 block mb-2">Resume Document</label>
                        <a 
                          href={`${API_BASE_URL.replace('/api', '')}/${candidate?.resume_path?.replace(/.*\/uploads\//, 'uploads/')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                        >
                          <FileText size={14} />
                          View Original Resume
                        </a>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Skills (comma separated)</label>
                      {editMode ? (
                        <input value={formData.skills?.join(', ') || ''} onChange={handleSkillsChange} className="input-field py-2" />
                      ) : (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {candidate?.skills?.map(skill => (
                            <span key={skill} className="px-2 py-0.5 bg-accent/5 text-accent rounded text-[10px] font-bold border border-accent/10 uppercase">
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Professional Info */}
                <div className="space-y-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Briefcase size={14} /> Professional Details
                  </h3>

                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase ml-1 flex items-center gap-1"><GraduationCap size={10}/>Education</label>
                      {renderEducation(candidate?.education)}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase ml-1 flex items-center gap-1"><Briefcase size={10}/>Experience</label>
                      {renderExperience(candidate?.experience)}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase ml-1 flex items-center gap-1"><Award size={10}/>Certifications</label>
                      {renderCertifications(candidate?.certifications)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Interview Feedback */}
              <div className="space-y-6 pt-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <MessageSquare size={14} /> Interview Feedback Rounds
                  </h3>
                </div>

                <div className="space-y-4">
                  {candidate?.interviews?.length > 0 ? (
                    candidate.interviews.map((round) => (
                      <div key={round.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-900 shadow-sm">
                              {round.round_number}
                            </span>
                            <span className="text-sm font-bold text-slate-900">Round {round.round_number}</span>
                          </div>
                          
                          <select 
                            value={round.status || ''} 
                            onChange={(e) => updateInterview(round.id, 'status', e.target.value)}
                            className={cn(
                              "text-[11px] font-bold px-3 py-1.5 rounded-lg border focus:outline-none transition-all cursor-pointer",
                              round.status === 'Selected' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                              round.status === 'Rejected' ? "bg-rose-50 text-rose-600 border-rose-100" :
                              "bg-white text-slate-400 border-slate-200"
                            )}
                          >
                            <option value="">No Status</option>
                            <option value="Selected">Selected</option>
                            <option value="Rejected">Rejected</option>
                            <option value="Hold">Hold</option>
                          </select>
                        </div>
                        
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Feedback Details</label>
                            {round.interviewer && (
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Interviewer: {round.interviewer}</span>
                            )}
                          </div>
                          <textarea 
                            defaultValue={typeof round.feedback === 'string' ? round.feedback : JSON.stringify(round.feedback)}
                            onBlur={(e) => updateInterview(round.id, 'feedback', e.target.value)}
                            placeholder="Add feedback notes here..."
                            className="w-full bg-white border-none focus:ring-2 focus:ring-accent/20 rounded-xl p-3 text-sm text-slate-700 min-h-[60px] shadow-sm italic"
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                      <p className="text-sm text-slate-400 font-medium">No interview rounds found for this candidate.</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default CandidateModal;
