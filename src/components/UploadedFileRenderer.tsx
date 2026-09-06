import React from 'react';
import { UploadedFileData, PrintJob } from '../types';
import { FileText, File, Image as ImageIcon, Sparkles, Layers, Printer } from 'lucide-react';
import { formatBytes } from '../utils/fileProcessor';

interface UploadedFileRendererProps {
  job?: Partial<PrintJob>;
  fileData: UploadedFileData;
}

export const UploadedFileRenderer: React.FC<UploadedFileRendererProps> = ({ job, fileData }) => {
  const isDocScan = fileData.documentContrastFilter;
  const jobId = job?.id ? job.id.slice(0, 8) : 'preview';
  const jobDate = job?.createdAt ? new Date(job.createdAt).toLocaleDateString() : new Date().toLocaleDateString();
  const jobTitle = job?.title || fileData.fileName;

  return (
    <div className="w-full bg-white text-slate-900">
      {/* 1. MULTI-PAGE PDF RENDERING */}
      {fileData.category === 'pdf' && (
        <div className="w-full">
          {fileData.pdfPages && fileData.pdfPages.length > 0 ? (
            <div className="space-y-6 print:space-y-0">
              {fileData.pdfPages.map((page, idx) => (
                <div
                  key={`pdf-page-${page.pageNumber}`}
                  className="break-after-page print:break-after-page flex flex-col items-center justify-start mx-auto relative bg-white"
                >
                  {/* Subtle screen page badge (hidden in print) */}
                  <div className="no-print w-full flex items-center justify-between py-1.5 px-4 bg-slate-100/90 border-b border-slate-200 text-[11px] font-semibold text-slate-600 rounded-t-lg">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-rose-500" />
                      Page {page.pageNumber} of {fileData.pdfPages?.length}
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {page.width} × {page.height} px
                    </span>
                  </div>

                  <div className="w-full flex items-center justify-center p-2 sm:p-4 print:p-0">
                    <img
                      src={page.dataUrl}
                      alt={`${fileData.fileName} - Page ${page.pageNumber}`}
                      className={`max-w-full h-auto shadow-xs print:shadow-none object-contain print:w-full ${
                        isDocScan ? 'doc-scan-enhanced' : ''
                      }`}
                      style={{ maxHeight: 'calc(100vh - 120px)' }}
                    />
                  </div>

                  {fileData.showPageNumbers && (
                    <div className="w-full pt-2 pb-1 text-center text-[10px] text-slate-400 font-mono hidden print:block">
                      {fileData.fileName} • Page {page.pageNumber} of {fileData.pdfPages?.length}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : fileData.dataUrl ? (
            /* Fallback native PDF preview/embed */
            <div className="p-4 sm:p-8">
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="no-print p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-700 font-medium">
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-rose-500" />
                    {fileData.fileName} ({formatBytes(fileData.fileSize)})
                  </span>
                  <a
                    href={fileData.dataUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-900 underline font-semibold text-xs"
                  >
                    Open Full PDF
                  </a>
                </div>
                <iframe
                  src={fileData.dataUrl}
                  title={fileData.fileName}
                  className="w-full h-[650px] border-0"
                />
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">PDF data is loading or unavailable.</div>
          )}
        </div>
      )}

      {/* 2. DUAL-SIDED ID CARD / FRONT & BACK IMAGES RENDERING */}
      {fileData.isDualSideId && fileData.frontImage && fileData.backImage && (
        <div className="w-full">
          {fileData.dualLayout === 'separate-2pages' ? (
            /* Layout: 2 Separate Pages / Back-to-Back */
            <div className="space-y-6 print:space-y-0">
              {/* Page 1: Front Side */}
              <div className="break-after-page print:break-after-page flex flex-col items-center justify-center min-h-[60vh] print:min-h-screen p-4 sm:p-8 bg-white">
                <div className="no-print w-full max-w-xl flex items-center justify-between py-1 px-3 mb-3 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                    PAGE 1: FRONT SIDE
                  </span>
                  <span className="text-slate-500 font-normal">
                    {fileData.frontImage.fileName} ({formatBytes(fileData.frontImage.fileSize)})
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center max-w-xl w-full">
                  <img
                    src={fileData.frontImage.dataUrl}
                    alt="Front Side"
                    className={`max-h-[75vh] w-auto max-w-full object-contain rounded-lg print:rounded-none shadow-xs print:shadow-none border border-slate-200 print:border-slate-400 ${
                      isDocScan ? 'doc-scan-enhanced' : ''
                    }`}
                  />
                  <div className="hidden print:block text-center text-[10px] text-slate-500 mt-2 font-mono">
                    FRONT SIDE • #{jobId}
                  </div>
                </div>
              </div>

              {/* Page 2: Back Side */}
              <div className="break-after-page print:break-after-page flex flex-col items-center justify-center min-h-[60vh] print:min-h-screen p-4 sm:p-8 bg-white">
                <div className="no-print w-full max-w-xl flex items-center justify-between py-1 px-3 mb-3 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                    PAGE 2: BACK SIDE
                  </span>
                  <span className="text-slate-500 font-normal">
                    {fileData.backImage.fileName} ({formatBytes(fileData.backImage.fileSize)})
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center max-w-xl w-full">
                  <img
                    src={fileData.backImage.dataUrl}
                    alt="Back Side"
                    className={`max-h-[75vh] w-auto max-w-full object-contain rounded-lg print:rounded-none shadow-xs print:shadow-none border border-slate-200 print:border-slate-400 ${
                      isDocScan ? 'doc-scan-enhanced' : ''
                    }`}
                  />
                  <div className="hidden print:block text-center text-[10px] text-slate-500 mt-2 font-mono">
                    BACK SIDE • #{jobId}
                  </div>
                </div>
              </div>
            </div>
          ) : fileData.dualLayout === 'side-by-side-1page' ? (
            /* Layout: Side-by-Side on 1 Sheet */
            <div className="p-4 sm:p-8 max-w-5xl mx-auto flex flex-col items-center">
              <div className="no-print w-full pb-3 mb-4 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  ID Card / 2-Sided (Side-by-Side on 1 Page)
                </span>
                <span>{formatBytes(fileData.fileSize)}</span>
              </div>

              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-6 print:grid-cols-2 print:gap-6 items-center justify-center">
                {/* Front Side */}
                <div className="flex flex-col items-center">
                  <div className="no-print text-xs font-bold text-slate-600 mb-2 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    FRONT SIDE
                  </div>
                  <img
                    src={fileData.frontImage.dataUrl}
                    alt="Front Side"
                    className={`max-h-[60vh] w-auto max-w-full object-contain rounded-lg print:rounded-none shadow-xs print:shadow-none border border-slate-200 print:border-slate-400 ${
                      isDocScan ? 'doc-scan-enhanced' : ''
                    }`}
                  />
                </div>

                {/* Back Side */}
                <div className="flex flex-col items-center">
                  <div className="no-print text-xs font-bold text-slate-600 mb-2 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    BACK SIDE
                  </div>
                  <img
                    src={fileData.backImage.dataUrl}
                    alt="Back Side"
                    className={`max-h-[60vh] w-auto max-w-full object-contain rounded-lg print:rounded-none shadow-xs print:shadow-none border border-slate-200 print:border-slate-400 ${
                      isDocScan ? 'doc-scan-enhanced' : ''
                    }`}
                  />
                </div>
              </div>

              <div className="w-full mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                <span>Front &amp; Back Print • Scan &amp; Print Direct</span>
                <span>Ref #{jobId}</span>
              </div>
            </div>
          ) : (
            /* Layout: Stacked Top & Bottom on 1 Sheet (Standard ID Card Print) */
            <div className="p-4 sm:p-8 max-w-3xl mx-auto flex flex-col items-center">
              <div className="no-print w-full pb-3 mb-4 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  ID Card Print (Front &amp; Back Stacked on 1 Page)
                </span>
                <span>{formatBytes(fileData.fileSize)}</span>
              </div>

              <div className="w-full flex flex-col items-center justify-center space-y-6 print:space-y-8">
                {/* Front Side */}
                <div className="w-full flex flex-col items-center">
                  <div className="no-print text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    FRONT SIDE
                  </div>
                  <img
                    src={fileData.frontImage.dataUrl}
                    alt="Front Side"
                    className={`max-h-[38vh] w-auto max-w-full object-contain rounded-lg print:rounded-none shadow-xs print:shadow-none border border-slate-200 print:border-slate-400 ${
                      isDocScan ? 'doc-scan-enhanced' : ''
                    }`}
                  />
                </div>

                {/* Back Side */}
                <div className="w-full flex flex-col items-center">
                  <div className="no-print text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    BACK SIDE
                  </div>
                  <img
                    src={fileData.backImage.dataUrl}
                    alt="Back Side"
                    className={`max-h-[38vh] w-auto max-w-full object-contain rounded-lg print:rounded-none shadow-xs print:shadow-none border border-slate-200 print:border-slate-400 ${
                      isDocScan ? 'doc-scan-enhanced' : ''
                    }`}
                  />
                </div>
              </div>

              <div className="w-full mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                <span>Front &amp; Back ID Print • Scan &amp; Print Direct</span>
                <span>Ref #{jobId}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. STANDARD SINGLE IMAGE / PHOTO RENDERING */}
      {fileData.category === 'image' && !fileData.isDualSideId && fileData.dataUrl && (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto flex flex-col items-center">
          {/* Header metadata (subtle on screen, minimal on print) */}
          <div className="w-full pb-3 mb-4 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-emerald-600" />
              {fileData.fileName}
            </span>
            <span>{formatBytes(fileData.fileSize)}</span>
          </div>

          {/* Image Container */}
          <div
            className={`w-full flex items-center justify-center ${
              fileData.imageFit === '2-up' ? 'grid grid-cols-2 gap-4' : ''
            }`}
          >
            <div className="flex flex-col items-center">
              <img
                src={fileData.dataUrl}
                alt={fileData.fileName}
                className={`rounded-sm print:rounded-none transition-all ${
                  isDocScan ? 'doc-scan-enhanced' : ''
                } ${
                  fileData.imageFit === 'fit-page'
                    ? 'max-h-[82vh] w-auto max-w-full object-contain'
                    : fileData.imageFit === 'full-bleed'
                    ? 'w-full h-auto object-cover'
                    : fileData.imageFit === '2-up'
                    ? 'w-full max-h-[42vh] object-contain border border-slate-300'
                    : 'max-w-full h-auto'
                }`}
              />
            </div>

            {/* If 2-up mode requested (printing 2 copies on one sheet for ID cards or labels) */}
            {fileData.imageFit === '2-up' && (
              <div className="flex flex-col items-center">
                <img
                  src={fileData.dataUrl}
                  alt={`${fileData.fileName} (Copy 2)`}
                  className={`rounded-sm print:rounded-none transition-all ${
                    isDocScan ? 'doc-scan-enhanced' : ''
                  } w-full max-h-[42vh] object-contain border border-slate-300`}
                />
              </div>
            )}
          </div>

          {/* Print watermark footer */}
          <div className="w-full mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
            <span>Printed via Scan &amp; Print Direct</span>
            <span>Ref #{jobId}</span>
          </div>
        </div>
      )}

      {/* 3. TEXT / CODE / MARKDOWN / CSV / LOGS */}
      {fileData.category === 'text' && (
        <div className="p-8 sm:p-12 max-w-4xl mx-auto">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {fileData.fileName}
              </h1>
              <span className="text-xs font-mono text-slate-500">
                {formatBytes(fileData.fileSize)} • {jobDate}
              </span>
            </div>
          </div>

          {/* Formatted Text Content */}
          <div className="font-mono text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words text-slate-800 bg-slate-50/50 p-4 rounded-lg border border-slate-200 print:bg-transparent print:border-none print:p-0">
            {fileData.textPreview || 'Empty file content.'}
          </div>

          <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between text-[10px] text-slate-400 font-mono">
            <span>Scan &amp; Print Direct • Text Document</span>
            <span>{jobTitle}</span>
          </div>
        </div>
      )}

      {/* 4. OTHER DOCUMENT TYPES (.DOCX, SPREADSHEETS, ETC.) */}
      {(fileData.category === 'document' || fileData.category === 'other') && (
        <div className="p-8 sm:p-12 max-w-3xl mx-auto">
          <div className="border-b border-slate-300 pb-5 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <File className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{fileData.fileName}</h1>
                <p className="text-xs text-slate-500">
                  {formatBytes(fileData.fileSize)} • {fileData.mimeType}
                </p>
              </div>
            </div>
          </div>

          {fileData.textPreview ? (
            <div className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-slate-800 space-y-4">
              {fileData.textPreview}
            </div>
          ) : (
            <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-3">
              <Printer className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-800">
                Binary or Rich Document Ready for Print Spooling
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                File metadata is loaded. Tapping <strong>Send to Print</strong> triggers your mobile system print spooler.
              </p>
            </div>
          )}

          <div className="mt-12 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
            Scan &amp; Print Direct • Document Reference #{jobId}
          </div>
        </div>
      )}
    </div>
  );
};
