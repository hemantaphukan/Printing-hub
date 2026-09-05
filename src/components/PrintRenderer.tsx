import React from 'react';
import { PrintJob } from '../types';
import { BarcodeRenderer } from './BarcodeRenderer';
import { UploadedFileRenderer } from './UploadedFileRenderer';
import { Check, Scissors } from 'lucide-react';

interface PrintRendererProps {
  job: PrintJob;
  isPrintMode?: boolean; // true during actual @media print or print container
}

export const PrintRenderer: React.FC<PrintRendererProps> = ({ job, isPrintMode = false }) => {
  const fontScaleClass = {
    sm: 'text-xs leading-relaxed',
    md: 'text-sm leading-relaxed',
    lg: 'text-base leading-relaxed',
  }[job.fontScale || 'md'];

  const colorFilterClass = {
    color: '',
    grayscale: 'filter grayscale',
    'high-contrast': 'contrast-125 brightness-95',
  }[job.colorMode || 'color'];

  // Render individual template types
  return (
    <div
      id="printable-content"
      className={`print-sheet bg-white text-slate-900 transition-all duration-150 ${colorFilterClass} ${fontScaleClass}`}
    >
      {/* 0. CUSTOM ANY FILE UPLOADED (PDF, IMAGE, TEXT, ETC.) */}
      {job.type === 'uploaded-file' && job.uploadedFile && (
        <UploadedFileRenderer job={job} fileData={job.uploadedFile} />
      )}

      {/* 1. DOCUMENT / LETTER / REPORT */}
      {job.type === 'document' && job.document && (
        <div className="p-8 sm:p-12 max-w-3xl mx-auto">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-6 mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 uppercase">
              {job.document.header}
            </h1>
            {job.document.subtitle && (
              <p className="text-sm font-medium text-slate-600 mt-1">
                {job.document.subtitle}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-200 text-xs text-slate-600">
              {job.document.author && (
                <span><strong>Issued by:</strong> {job.document.author}</span>
              )}
              {job.document.date && (
                <span><strong>Date:</strong> {job.document.date}</span>
              )}
              <span><strong>Doc Ref:</strong> {job.id.toUpperCase()}</span>
            </div>
          </div>

          {/* Body Content */}
          <div className="space-y-4 whitespace-pre-line text-slate-800 font-serif leading-relaxed text-justify">
            {job.document.content}
          </div>

          {/* Signature Block */}
          {job.document.showSignatureLine && (
            <div className="mt-16 pt-8 border-t border-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-8 break-inside-avoid">
              <div>
                <div className="h-12 border-b border-slate-800 mb-2"></div>
                <p className="text-xs font-semibold text-slate-900">
                  {job.document.signatureLabel || 'Authorized Signature'}
                </p>
                <p className="text-[11px] text-slate-500">Date: ____________________</p>
              </div>
              <div>
                <div className="h-12 border-b border-slate-800 mb-2"></div>
                <p className="text-xs font-semibold text-slate-900">
                  Countersignature / Acceptance
                </p>
                <p className="text-[11px] text-slate-500">Date: ____________________</p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-12 pt-4 border-t border-slate-200 text-[10px] text-slate-400 text-center uppercase tracking-widest break-inside-avoid">
            Printed directly from Mobile via Scan &amp; Print Direct • Verification ID #{job.id}
          </div>
        </div>
      )}

      {/* 2. RECEIPT (80mm Thermal POS style) */}
      {job.type === 'receipt' && job.receipt && (
        <div className="p-6 sm:p-8 max-w-[380px] mx-auto font-mono text-xs bg-white text-slate-900">
          <div className="text-center pb-4 border-b border-dashed border-slate-400">
            <h2 className="text-base font-bold tracking-wider uppercase">
              {job.receipt.merchantName}
            </h2>
            {job.receipt.merchantAddress && (
              <p className="text-[11px] text-slate-600 mt-1">{job.receipt.merchantAddress}</p>
            )}
            {job.receipt.merchantPhone && (
              <p className="text-[11px] text-slate-600">{job.receipt.merchantPhone}</p>
            )}
            <div className="mt-3 text-[10px] text-slate-500 flex justify-between px-1">
              <span>RCPT: {job.receipt.receiptNumber}</span>
              <span>{job.receipt.date}</span>
            </div>
          </div>

          {/* Line items table */}
          <div className="py-4 border-b border-dashed border-slate-400 space-y-2">
            <div className="grid grid-cols-12 font-bold text-[10px] text-slate-600 uppercase pb-1 border-b border-slate-200">
              <span className="col-span-2">Qty</span>
              <span className="col-span-7">Description</span>
              <span className="col-span-3 text-right">Amount</span>
            </div>
            {job.receipt.items.map((item) => (
              <div key={item.id} className="grid grid-cols-12 py-1 text-slate-800">
                <span className="col-span-2 font-semibold">{item.qty}x</span>
                <span className="col-span-7 truncate pr-1">{item.name}</span>
                <span className="col-span-3 text-right">
                  ${(item.qty * item.price).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {/* Calculations */}
          {(() => {
            const subtotal = job.receipt.items.reduce(
              (acc, item) => acc + item.qty * item.price,
              0
            );
            const tax = (subtotal * job.receipt.taxPercent) / 100;
            const tip = job.receipt.tipAmount || 0;
            const grandTotal = subtotal + tax + tip;

            return (
              <div className="py-3 border-b border-dashed border-slate-400 space-y-1.5 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tax ({job.receipt.taxPercent}%)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                {tip > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tip</span>
                    <span>${tip.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-800 text-slate-900">
                  <span>TOTAL DUE</span>
                  <span>${grandTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 pt-1">
                  <span>Payment Method:</span>
                  <span className="font-semibold">{job.receipt.paymentMethod}</span>
                </div>
              </div>
            );
          })()}

          {/* Barcode & Footer */}
          <div className="pt-4 text-center space-y-3">
            <BarcodeRenderer value={job.receipt.barcodeValue} height={40} />
            <p className="text-[10px] text-slate-600 italic px-2">
              {job.receipt.footerNote}
            </p>
            <div className="text-[9px] text-slate-400 uppercase tracking-widest pt-2">
              *** Native Mobile Print Spool ***
            </div>
          </div>
        </div>
      )}

      {/* 3. SHIPPING LABEL (4x6 format) */}
      {job.type === 'label' && job.label && (
        <div className="p-6 max-w-[420px] mx-auto border-2 border-slate-900 bg-white text-slate-900 text-xs">
          {/* Top Carrier Header */}
          <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-center">
            <div>
              <span className="text-xl font-black tracking-tight uppercase">
                {job.label.carrier}
              </span>
              <p className="text-[10px] font-bold tracking-widest uppercase text-slate-700">
                {job.label.serviceType}
              </p>
            </div>
            <div className="text-right">
              <div className="border-2 border-slate-900 px-3 py-1 text-center font-black text-sm uppercase">
                ZONE 4
              </div>
              <span className="text-[9px] text-slate-600">{job.label.weight}</span>
            </div>
          </div>

          {/* Sender Box */}
          <div className="py-2.5 border-b border-slate-300 text-[10px] leading-tight text-slate-700">
            <span className="font-bold text-slate-900 uppercase">SHIP FROM:</span>
            <div className="font-semibold text-slate-800">{job.label.senderName}</div>
            <div className="whitespace-pre-line text-slate-600">{job.label.senderAddress}</div>
          </div>

          {/* Recipient Box (Large for scanning & delivery) */}
          <div className="py-4 border-b-2 border-slate-900 bg-slate-50/50 p-2 my-2">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              SHIP TO:
            </span>
            <div className="text-base font-black text-slate-900 uppercase mt-0.5">
              {job.label.recipientName}
            </div>
            <div className="text-xs font-semibold whitespace-pre-line text-slate-800 mt-1 leading-snug">
              {job.label.recipientAddress}
            </div>
          </div>

          {/* Routing Barcode */}
          <div className="py-3 text-center border-b border-slate-300">
            <BarcodeRenderer value={job.label.trackingNumber} height={56} />
            <div className="text-[10px] font-mono font-bold mt-1 text-slate-800">
              TRACKING: {job.label.trackingNumber}
            </div>
          </div>

          {/* Details & Notes */}
          <div className="pt-2 flex justify-between text-[10px] text-slate-600">
            <span><strong>Pkg:</strong> {job.label.packageType || 'Standard'}</span>
            <span><strong>Ref:</strong> {job.id.slice(0, 8).toUpperCase()}</span>
          </div>
          {job.label.notes && (
            <p className="mt-2 text-[10px] font-bold text-slate-800 bg-slate-100 p-1.5 border border-slate-300 text-center uppercase">
              {job.label.notes}
            </p>
          )}
        </div>
      )}

      {/* 4. TICKET / BOARDING PASS */}
      {job.type === 'ticket' && job.ticket && (
        <div className="p-6 max-w-xl mx-auto border-2 border-dashed border-slate-400 bg-white text-slate-900 relative">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Main Ticket Portion */}
            <div className="flex-1 space-y-3">
              <div className="border-b border-slate-200 pb-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                  Official Admission Pass
                </span>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
                  {job.ticket.eventName}
                </h2>
                <p className="text-xs font-semibold text-slate-600">{job.ticket.venue}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Date</span>
                  <span className="font-bold text-slate-800">{job.ticket.date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Time</span>
                  <span className="font-bold text-slate-800">{job.ticket.time}</span>
                </div>
              </div>

              {/* Seating Block */}
              <div className="grid grid-cols-3 gap-2 bg-slate-100 p-2.5 rounded border border-slate-200 text-center">
                <div>
                  <span className="text-[9px] uppercase text-slate-500 font-bold block">Gate</span>
                  <span className="font-black text-xs text-slate-900">{job.ticket.gate || 'GA'}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase text-slate-500 font-bold block">Section</span>
                  <span className="font-black text-xs text-slate-900">{job.ticket.section || 'General'}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase text-slate-500 font-bold block">Seat</span>
                  <span className="font-black text-xs text-slate-900">{job.ticket.seat || 'Open'}</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs pt-1">
                <div>
                  <span className="text-[10px] text-slate-500 block">Attendee:</span>
                  <span className="font-bold text-slate-800">{job.ticket.ticketHolder}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Tier:</span>
                  <span className="font-semibold text-slate-800">{job.ticket.ticketType}</span>
                </div>
              </div>

              {job.ticket.admissionNote && (
                <p className="text-[10px] text-slate-500 italic pt-1 border-t border-slate-100">
                  {job.ticket.admissionNote}
                </p>
              )}
            </div>

            {/* Stub with Barcode */}
            <div className="sm:border-l sm:border-dashed sm:border-slate-300 sm:pl-6 flex flex-col items-center justify-center text-center space-y-3">
              <div className="hidden sm:flex items-center gap-1 text-[9px] text-slate-400 uppercase tracking-widest">
                <Scissors className="w-3 h-3 rotate-90" /> TEAR STUB
              </div>
              <BarcodeRenderer value={job.ticket.barcodeValue} height={50} />
              <span className="text-[10px] font-mono text-slate-500">#{job.ticket.barcodeValue}</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. PHOTO PRINT */}
      {job.type === 'photo' && job.photo && (
        <div className="p-6 max-w-lg mx-auto bg-white flex flex-col items-center">
          <div
            className={`w-full overflow-hidden ${
              job.photo.borderStyle === 'polaroid'
                ? 'p-3 pb-8 bg-white border border-slate-300 shadow-sm'
                : job.photo.borderStyle === 'thin-white'
                ? 'p-2 border border-slate-200'
                : ''
            }`}
          >
            <img
              src={job.photo.imageUrl}
              alt={job.title}
              className={`w-full h-auto object-cover max-h-[500px] ${
                job.photo.fitMode === 'fit' ? 'object-contain' : 'object-cover'
              }`}
              referrerPolicy="no-referrer"
            />
            {job.photo.caption && (
              <p
                className={`mt-4 text-center text-slate-800 ${
                  job.photo.borderStyle === 'polaroid'
                    ? 'font-serif text-sm tracking-wide'
                    : 'text-xs text-slate-600'
                }`}
              >
                {job.photo.caption}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 6. NOTE / CHECKLIST */}
      {job.type === 'note' && job.note && (
        <div className="p-8 max-w-2xl mx-auto bg-white text-slate-900">
          <div className="border-b-2 border-slate-900 pb-3 mb-6 flex justify-between items-baseline">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {job.note.heading}
            </h1>
            <span className="text-xs text-slate-500 font-mono">
              {new Date(job.createdAt).toLocaleDateString()}
            </span>
          </div>

          <p className="text-sm text-slate-700 mb-6 leading-relaxed whitespace-pre-line">
            {job.note.body}
          </p>

          {job.note.isChecklist && job.note.checklistItems && (
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                Action Items &amp; Tasks
              </h3>
              <div className="space-y-2">
                {job.note.checklistItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 py-1">
                    <div
                      className={`w-4 h-4 mt-0.5 rounded-sm border flex items-center justify-center shrink-0 ${
                        item.done
                          ? 'border-slate-800 bg-slate-800 text-white'
                          : 'border-slate-400 bg-white'
                      }`}
                    >
                      {item.done && <Check className="w-3 h-3" />}
                    </div>
                    <span
                      className={`text-sm text-slate-800 ${
                        item.done ? 'line-through text-slate-400' : ''
                      }`}
                    >
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-12 pt-4 border-t border-slate-200 flex justify-between text-[10px] text-slate-400">
            <span>Scan &amp; Print Direct Mobile Link</span>
            <span>Ref #{job.id.slice(0, 8)}</span>
          </div>
        </div>
      )}

      {/* 7. WEBPAGE / LINK PRINTABLE SUMMARY */}
      {job.type === 'webpage' && job.webpage && (
        <div className="p-8 max-w-2xl mx-auto bg-white text-slate-900">
          <div className="border-b border-slate-300 pb-4 mb-6">
            <span className="text-[11px] font-mono text-slate-500 block truncate">
              Source URL: {job.webpage.url}
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              {job.webpage.pageTitle}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">Source: {job.webpage.sourceDomain}</p>
          </div>

          <div className="space-y-4">
            <div className="text-sm leading-relaxed text-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Executive Summary
              </h3>
              <p>{job.webpage.summary}</p>
            </div>

            {job.webpage.keyPoints && job.webpage.keyPoints.length > 0 && (
              <div className="pt-4 border-t border-slate-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Key Takeaways
                </h3>
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-800">
                  {job.webpage.keyPoints.map((pt, i) => (
                    <li key={i}>{pt}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-12 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400 uppercase tracking-widest">
            Webpage Print Digest • Generated for Direct Mobile Print
          </div>
        </div>
      )}
    </div>
  );
};
