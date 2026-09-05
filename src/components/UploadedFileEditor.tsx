import React, { useState, useRef } from 'react';
import { PrintJob, PaperSize, PrintOrientation, PrintColorMode } from '../types';
import { processUploadedFile, formatBytes, createSamplePdfJob } from '../utils/fileProcessor';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  File,
  Camera,
  Sparkles,
  RotateCw,
  Sliders,
  CheckCircle2,
  RefreshCw,
  Eye,
  AlertCircle
} from 'lucide-react';

interface UploadedFileEditorProps {
  job: PrintJob;
  onUpdateJob: (updated: PrintJob) => void;
  onPreview: () => void;
}

export const UploadedFileEditor: React.FC<UploadedFileEditorProps> = ({
  job,
  onUpdateJob,
  onPreview,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setProcessingStatus(`Analyzing ${file.name}...`);

      const newJob = await processUploadedFile(file, (status) => {
        setProcessingStatus(status);
      });

      onUpdateJob(newJob);
    } catch (err: any) {
      console.error('File processing error:', err);
      setErrorMessage(err.message || 'Failed to process file for printing');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const fileData = job.uploadedFile;

  return (
    <div className="space-y-6">
      {/* File Upload / Dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition cursor-pointer ${
          isDragging
            ? 'border-slate-900 bg-slate-100'
            : 'border-slate-300 hover:border-slate-400 bg-slate-50/70 hover:bg-slate-50'
        }`}
      >
        <input
          ref={fileInputRef}
          id="file-upload-input"
          type="file"
          accept="*/*"
          className="hidden"
          onChange={handleInputChange}
        />
        <input
          ref={cameraInputRef}
          id="camera-upload-input"
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleInputChange}
        />

        <div className="max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-800 flex items-center justify-center mx-auto shadow-2xs">
            {isProcessing ? (
              <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
            ) : (
              <Upload className="w-6 h-6 text-slate-700" />
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {isProcessing ? 'Processing File for Print...' : 'Upload ANY File to Print via QR'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Drag &amp; drop any PDF, high-res photo, scanned document, text, or receipt here, or click to browse.
            </p>
          </div>

          {isProcessing ? (
            <div className="text-xs text-amber-600 font-medium animate-pulse">
              {processingStatus || 'Rendering file pages...'}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                PDF Documents
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Photos &amp; Images
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Text &amp; Code
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                Labels &amp; Receipts
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              cameraInputRef.current?.click();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 font-semibold text-slate-700 transition cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5 text-slate-500" />
            <span>Scan with Camera</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const sample = createSamplePdfJob();
              onUpdateJob(sample);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100/80 font-semibold text-amber-900 transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Load Sample PDF Boarding Pass</span>
          </button>
        </div>

        {fileData && (
          <button
            type="button"
            onClick={onPreview}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview in Mobile View</span>
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Loaded File Info & Print Settings */}
      {fileData && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  fileData.category === 'pdf'
                    ? 'bg-rose-100 text-rose-700'
                    : fileData.category === 'image'
                    ? 'bg-emerald-100 text-emerald-700'
                    : fileData.category === 'text'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {fileData.category === 'pdf' ? (
                  <FileText className="w-5 h-5" />
                ) : fileData.category === 'image' ? (
                  <ImageIcon className="w-5 h-5" />
                ) : (
                  <File className="w-5 h-5" />
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                  {fileData.fileName}
                </h4>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="uppercase font-semibold text-[10px] tracking-wider bg-slate-200 px-1.5 py-0.5 rounded">
                    {fileData.category}
                  </span>
                  <span>{formatBytes(fileData.fileSize)}</span>
                  {fileData.pageCount && fileData.pageCount > 1 && (
                    <span>• {fileData.pageCount} Pages</span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline self-start sm:self-auto cursor-pointer"
            >
              Choose Different File
            </button>
          </div>

          {/* Settings Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Paper Format</label>
              <select
                value={job.paperSize}
                onChange={(e) => onUpdateJob({ ...job, paperSize: e.target.value as PaperSize })}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium"
              >
                <option value="letter">Letter (8.5 × 11")</option>
                <option value="a4">A4 (210 × 297mm)</option>
                <option value="label-4x6">4 × 6" Shipping Label</option>
                <option value="photo-4x6">4 × 6" Photo Paper</option>
                <option value="receipt-80mm">80mm POS Thermal</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Orientation</label>
              <div className="flex bg-white border border-slate-300 rounded-lg p-0.5">
                {(['portrait', 'landscape'] as PrintOrientation[]).map((orient) => (
                  <button
                    key={orient}
                    type="button"
                    onClick={() => onUpdateJob({ ...job, orientation: orient })}
                    className={`flex-1 py-1 text-center font-semibold capitalize rounded-md transition cursor-pointer ${
                      job.orientation === orient
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {orient}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Color Mode</label>
              <select
                value={job.colorMode}
                onChange={(e) => onUpdateJob({ ...job, colorMode: e.target.value as PrintColorMode })}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium"
              >
                <option value="color">Full Color</option>
                <option value="grayscale">Grayscale / Black &amp; White</option>
                <option value="high-contrast">High-Contrast (Crisp Text)</option>
              </select>
            </div>
          </div>

          {/* Contextual Settings for Images & Camera Scans */}
          {(fileData.category === 'image' || fileData.category === 'pdf') && (
            <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {fileData.category === 'image' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Image Fit</label>
                  <select
                    value={fileData.imageFit || 'fit-page'}
                    onChange={(e) =>
                      onUpdateJob({
                        ...job,
                        uploadedFile: {
                          ...fileData,
                          imageFit: e.target.value as any,
                        },
                      })
                    }
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium"
                  >
                    <option value="fit-page">Fit to Page (Maintain Proportions)</option>
                    <option value="original">Original Size</option>
                    <option value="2-up">2-Up Copies (ID Cards / Badges on 1 page)</option>
                    <option value="full-bleed">Full Bleed (Edge to Edge)</option>
                  </select>
                </div>
              )}

              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer mt-3 sm:mt-5">
                  <input
                    type="checkbox"
                    checked={fileData.documentContrastFilter || false}
                    onChange={(e) =>
                      onUpdateJob({
                        ...job,
                        uploadedFile: {
                          ...fileData,
                          documentContrastFilter: e.target.checked,
                        },
                      })
                    }
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <div>
                    <span className="font-semibold text-slate-900 block">
                      Enhance Document Contrast (Scan Mode)
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Filters shadows and turns photos into clean black-and-white printouts.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
