import React, { useState } from 'react';
import { APIError, api } from '../api/client';

interface IdentityVerificationProps {
  onCancel: () => void;
  /**
   * Called after the backend accepts the documents. Deliberately takes no
   * URLs: the images are write-only from the client's perspective and are
   * destroyed server-side once an admin decides.
   */
  onComplete: () => void;
}

export const IdentityVerification: React.FC<IdentityVerificationProps> = ({ onCancel, onComplete }) => {
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  const [idFile, setIdFile] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelfieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelfieFile(file);
      setSelfiePreview(URL.createObjectURL(file));
    }
  };

  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIdFile(file);
      setIdPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selfieFile || !idFile) {
      setError('Both a personal photo and an official ID are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api.identity.upload(selfieFile, idFile);

      // Release the local previews: there is no reason to keep decoded copies
      // of an identity document in memory after submission.
      if (selfiePreview) URL.revokeObjectURL(selfiePreview);
      if (idPreview) URL.revokeObjectURL(idPreview);

      onComplete();
    } catch (err) {
      setError(
        err instanceof APIError ? err.message : 'Upload failed. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#09090b] text-zinc-100 min-h-screen flex flex-col relative overflow-x-hidden selection:bg-indigo-600 selection:text-white">
      {/* Atmospheric Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-zinc-800/20 rounded-full blur-[150px]" />
      </div>

      {/* Main Content Canvas */}
      <main className="flex-grow flex items-center justify-center relative z-10 px-5 md:px-10 py-16 min-h-screen">
        <div className="w-full max-w-2xl bento-card rounded-[32px] p-8 md:p-12 relative overflow-hidden border border-zinc-800 shadow-2xl bg-zinc-900/40">
          {/* Top accent */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-80" />

          {/* Header Section */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 mb-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-label-caps text-xs font-bold uppercase">
              <span className="material-symbols-outlined text-sm">verified_user</span>
              Private &amp; Auto-Deleted
            </div>
            <h1 className="font-display-lg text-3xl md:text-4xl text-white mb-3">
              Identity Verification
            </h1>
            <p className="font-body-md text-sm text-zinc-400 max-w-md mx-auto">
              To maintain the exclusivity and security of our cinematic events, please provide proof of identity.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Upload Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Personal Photo Slot */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps text-xs text-indigo-400 font-bold uppercase">01. Personal Photo</span>
                  <span className="material-symbols-outlined text-zinc-400 text-sm">face</span>
                </div>

                <label className="upload-slot rounded-2xl h-48 flex flex-col items-center justify-center cursor-pointer group relative overflow-hidden border-2 border-dashed border-zinc-800 hover:border-indigo-500/50 bg-zinc-950/60 transition-all">
                  <input accept="image/*" className="hidden" type="file" onChange={handleSelfieChange} />

                  {selfiePreview ? (
                    <div className="relative w-full h-full">
                      <img src={selfiePreview} alt="Selfie Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="font-label-caps text-xs text-white bg-zinc-900/90 px-3.5 py-1.5 rounded-full border border-zinc-700 font-bold">Change Photo</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-4xl text-zinc-500 group-hover:text-indigo-400 transition-colors mb-2">
                        add_a_photo
                      </span>
                      <span className="font-body-md text-sm text-zinc-300 group-hover:text-white transition-colors text-center px-4">
                        Upload Selfie
                      </span>
                      <span className="font-label-caps text-[10px] text-zinc-500 mt-2 font-bold">
                        JPG, PNG • Max 5MB
                      </span>
                    </>
                  )}
                </label>
                {selfieFile && (
                  <p className="text-xs text-emerald-400 font-label-caps font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    {selfieFile.name}
                  </p>
                )}
              </div>

              {/* ID Photo Slot */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps text-xs text-indigo-400 font-bold uppercase">02. Official ID</span>
                  <span className="material-symbols-outlined text-zinc-400 text-sm">badge</span>
                </div>

                <label className="upload-slot rounded-2xl h-48 flex flex-col items-center justify-center cursor-pointer group relative overflow-hidden border-2 border-dashed border-zinc-800 hover:border-indigo-500/50 bg-zinc-950/60 transition-all">
                  <input accept="image/*" className="hidden" type="file" onChange={handleIdChange} />

                  {idPreview ? (
                    <div className="relative w-full h-full">
                      <img src={idPreview} alt="ID Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="font-label-caps text-xs text-white bg-zinc-900/90 px-3.5 py-1.5 rounded-full border border-zinc-700 font-bold">Change ID</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-4xl text-zinc-500 group-hover:text-indigo-400 transition-colors mb-2">
                        id_card
                      </span>
                      <span className="font-body-md text-sm text-zinc-300 group-hover:text-white transition-colors text-center px-4">
                        Upload Passport or License
                      </span>
                      <span className="font-label-caps text-[10px] text-zinc-500 mt-2 font-bold">
                        Clear, well-lit image
                      </span>
                    </>
                  )}
                </label>
                {idFile && (
                  <p className="text-xs text-emerald-400 font-label-caps font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    {idFile.name}
                  </p>
                )}
              </div>
            </div>

            {/* Security Notice Bento Tile */}
            <div className="bg-zinc-950/80 rounded-2xl p-4 mb-8 flex items-start gap-4 border border-zinc-800">
              <span className="material-symbols-outlined text-indigo-400 mt-0.5 text-2xl">lock</span>
              <div>
                <h3 className="font-headline-md text-sm text-white mb-0.5">Reviewed once, then destroyed</h3>
                <p className="font-body-md text-xs text-zinc-400 leading-relaxed">
                  Your documents are stored on private, non-public storage and are
                  never viewable by other members. A single administrator opens
                  them once, behind a password, and they are permanently deleted
                  the moment your review is decided.
                </p>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div
                role="alert"
                className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3 font-body-md text-sm text-red-300"
              >
                <span className="material-symbols-outlined text-lg leading-none">error</span>
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-end border-t border-zinc-800 pt-6">
              <button
                type="button"
                onClick={onCancel}
                className="font-label-caps text-xs font-bold text-zinc-400 hover:text-white py-3 px-8 rounded-full border border-zinc-800 hover:border-zinc-700 transition-all focus:outline-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary font-headline-md text-xs uppercase tracking-wider py-3.5 px-8 rounded-full flex items-center justify-center gap-2 focus:outline-none cursor-pointer disabled:opacity-50 shadow-lg shadow-indigo-600/30"
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin material-symbols-outlined text-sm">sync</span>
                    <span>Encrypting & Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Submit for Verification</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};
