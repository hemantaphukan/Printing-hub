import React, { useState } from 'react';
import { PrintJob, PrintJobType, PaperSize, PrintOrientation } from '../types';
import { SAMPLE_JOBS } from '../data/sampleJobs';
import { UploadedFileEditor } from './UploadedFileEditor';
import { createSamplePdfJob } from '../utils/fileProcessor';
import {
  FileText,
  Receipt,
  Tag,
  Ticket,
  Image as ImageIcon,
  CheckSquare,
  Globe,
  Upload,
  Sparkles,
  Plus,
  Trash2,
  Sliders,
  Eye
} from 'lucide-react';

interface JobEditorProps {
  job: PrintJob;
  onUpdateJob: (updated: PrintJob) => void;
  onPreview: () => void;
}

export const JobEditor: React.FC<JobEditorProps> = ({ job, onUpdateJob, onPreview }) => {
  const [selectedType, setSelectedType] = useState<PrintJobType>(job.type);

  // Switch template preset
  const handleTypeChange = (type: PrintJobType) => {
    setSelectedType(type);
    if (type === 'uploaded-file') {
      if (job.uploadedFile) {
        onUpdateJob({
          ...job,
          type: 'uploaded-file',
        });
      } else {
        onUpdateJob(createSamplePdfJob());
      }
      return;
    }

    const sample = SAMPLE_JOBS[type] || SAMPLE_JOBS.document;
    onUpdateJob({
      ...sample,
      id: `job-${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
    });
  };

  // Image upload handler for photo template
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onUpdateJob({
        ...job,
        photo: {
          imageUrl: dataUrl,
          caption: file.name.replace(/\.[^/.]+$/, ''),
          aspectRatio: 'standard',
          fitMode: 'fill',
          borderStyle: 'polaroid',
        },
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Print Job Content &amp; Setup
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Choose what to send to print, or edit details directly.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="editor-preview-btn"
            type="button"
            onClick={onPreview}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Mobile Preview</span>
          </button>
        </div>
      </div>

      {/* Preset Type Selector Pills */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          Select Document Type
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {[
            { type: 'uploaded-file', label: 'Any File / PDF', icon: Upload },
            { type: 'document', label: 'Document', icon: FileText },
            { type: 'receipt', label: 'Receipt', icon: Receipt },
            { type: 'label', label: 'Shipping Label', icon: Tag },
            { type: 'ticket', label: 'Ticket / Pass', icon: Ticket },
            { type: 'photo', label: 'Photo', icon: ImageIcon },
            { type: 'note', label: 'Checklist', icon: CheckSquare },
            { type: 'webpage', label: 'Web Summary', icon: Globe },
          ].map((item) => {
            const Icon = item.icon;
            const isSelected = job.type === item.type;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => handleTypeChange(item.type as PrintJobType)}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition cursor-pointer ${
                  isSelected
                    ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 mb-1.5 ${isSelected ? 'text-amber-400' : 'text-slate-500'}`} />
                <span className="text-xs font-semibold">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Basic Settings: Title, Paper Size, Auto Trigger */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200/70 rounded-xl text-xs">
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Title / Reference</label>
          <input
            id="job-title-input"
            type="text"
            value={job.title}
            onChange={(e) => onUpdateJob({ ...job, title: e.target.value })}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:ring-1 focus:ring-slate-900"
            placeholder="e.g. Sales Invoice #102"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Target Paper Size</label>
          <select
            id="job-paper-size-select"
            value={job.paperSize}
            onChange={(e) => onUpdateJob({ ...job, paperSize: e.target.value as PaperSize })}
            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:ring-1 focus:ring-slate-900"
          >
            <option value="letter">Letter (8.5 × 11")</option>
            <option value="a4">A4 (210 × 297mm)</option>
            <option value="label-4x6">4 × 6" Label</option>
            <option value="receipt-80mm">80mm POS Thermal Receipt</option>
            <option value="photo-4x6">4 × 6" Photo Paper</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Mobile Scan Behavior</label>
          <label className="flex items-center gap-2 cursor-pointer mt-2">
            <input
              id="job-autotrigger-checkbox"
              type="checkbox"
              checked={job.autoTrigger}
              onChange={(e) => onUpdateJob({ ...job, autoTrigger: e.target.checked })}
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <span className="text-slate-700 font-medium">Auto-open print dialog on mobile</span>
          </label>
        </div>
      </div>

      {/* Dynamic Content Form Fields */}
      <div className="space-y-4">
        {/* 0. ANY FILE / PDF / IMAGES / DOCS */}
        {job.type === 'uploaded-file' && (
          <UploadedFileEditor
            job={job}
            onUpdateJob={onUpdateJob}
            onPreview={onPreview}
          />
        )}

        {/* 1. DOCUMENT */}
        {job.type === 'document' && job.document && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Document Header</label>
                <input
                  type="text"
                  value={job.document.header}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      document: { ...job.document!, header: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subtitle</label>
                <input
                  type="text"
                  value={job.document.subtitle || ''}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      document: { ...job.document!, subtitle: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Author / Issuer</label>
                <input
                  type="text"
                  value={job.document.author || ''}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      document: { ...job.document!, author: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                <input
                  type="text"
                  value={job.document.date || ''}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      document: { ...job.document!, date: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Document Body Text</label>
              <textarea
                rows={7}
                value={job.document.content}
                onChange={(e) =>
                  onUpdateJob({
                    ...job,
                    document: { ...job.document!, content: e.target.value },
                  })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs font-sans text-slate-900 leading-relaxed"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={job.document.showSignatureLine}
                onChange={(e) =>
                  onUpdateJob({
                    ...job,
                    document: { ...job.document!, showSignatureLine: e.target.checked },
                  })
                }
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <span className="text-slate-700 font-semibold">Include Formal Signature Block at bottom</span>
            </label>
          </div>
        )}

        {/* 2. RECEIPT */}
        {job.type === 'receipt' && job.receipt && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Store / Business Name</label>
                <input
                  type="text"
                  value={job.receipt.merchantName}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      receipt: { ...job.receipt!, merchantName: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address / Location</label>
                <input
                  type="text"
                  value={job.receipt.merchantAddress || ''}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      receipt: { ...job.receipt!, merchantAddress: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Receipt / Invoice #</label>
                <input
                  type="text"
                  value={job.receipt.receiptNumber}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      receipt: { ...job.receipt!, receiptNumber: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
            </div>

            {/* Line items manager */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Itemized Charges
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const newItem = {
                      id: Date.now().toString(),
                      name: 'Item description',
                      qty: 1,
                      price: 5.0,
                    };
                    onUpdateJob({
                      ...job,
                      receipt: {
                        ...job.receipt!,
                        items: [...job.receipt!.items, newItem],
                      },
                    });
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Line Item</span>
                </button>
              </div>

              <div className="space-y-2">
                {job.receipt.items.map((item, idx) => (
                  <div key={item.id} className="flex gap-2 items-center">
                    <input
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) => {
                        const items = [...job.receipt!.items];
                        items[idx] = { ...item, qty: parseInt(e.target.value) || 1 };
                        onUpdateJob({
                          ...job,
                          receipt: { ...job.receipt!, items },
                        });
                      }}
                      className="w-16 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-center font-bold"
                      placeholder="Qty"
                    />
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => {
                        const items = [...job.receipt!.items];
                        items[idx] = { ...item, name: e.target.value };
                        onUpdateJob({
                          ...job,
                          receipt: { ...job.receipt!, items },
                        });
                      }}
                      className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs"
                      placeholder="Item Name"
                    />
                    <div className="relative w-24">
                      <span className="absolute left-2 top-1.5 text-xs text-slate-500">$</span>
                      <input
                        type="number"
                        step="0.25"
                        value={item.price}
                        onChange={(e) => {
                          const items = [...job.receipt!.items];
                          items[idx] = { ...item, price: parseFloat(e.target.value) || 0 };
                          onUpdateJob({
                            ...job,
                            receipt: { ...job.receipt!, items },
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-5 pr-2 py-1.5 text-xs text-right font-medium"
                      />
                    </div>
                    {job.receipt!.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const items = job.receipt!.items.filter((_, i) => i !== idx);
                          onUpdateJob({
                            ...job,
                            receipt: { ...job.receipt!, items },
                          });
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tax Percent (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={job.receipt.taxPercent}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      receipt: { ...job.receipt!, taxPercent: parseFloat(e.target.value) || 0 },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tip Amount ($)</label>
                <input
                  type="number"
                  step="0.5"
                  value={job.receipt.tipAmount || 0}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      receipt: { ...job.receipt!, tipAmount: parseFloat(e.target.value) || 0 },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Barcode Digits</label>
                <input
                  type="text"
                  value={job.receipt.barcodeValue}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      receipt: { ...job.receipt!, barcodeValue: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900"
                />
              </div>
            </div>
          </div>
        )}

        {/* 3. SHIPPING LABEL */}
        {job.type === 'label' && job.label && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Carrier Name</label>
                <input
                  type="text"
                  value={job.label.carrier}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      label: { ...job.label!, carrier: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Service Class</label>
                <input
                  type="text"
                  value={job.label.serviceType}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      label: { ...job.label!, serviceType: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tracking #</label>
                <input
                  type="text"
                  value={job.label.trackingNumber}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      label: { ...job.label!, trackingNumber: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Recipient Name</label>
                <input
                  type="text"
                  value={job.label.recipientName}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      label: { ...job.label!, recipientName: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-bold"
                />
                <label className="block text-xs font-semibold text-slate-700 mt-2 mb-1">Recipient Address</label>
                <textarea
                  rows={3}
                  value={job.label.recipientAddress}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      label: { ...job.label!, recipientAddress: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Sender Name</label>
                <input
                  type="text"
                  value={job.label.senderName}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      label: { ...job.label!, senderName: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
                <label className="block text-xs font-semibold text-slate-700 mt-2 mb-1">Sender Address</label>
                <textarea
                  rows={3}
                  value={job.label.senderAddress}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      label: { ...job.label!, senderAddress: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900"
                />
              </div>
            </div>
          </div>
        )}

        {/* 4. TICKET / PASS */}
        {job.type === 'ticket' && job.ticket && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Event Name</label>
                <input
                  type="text"
                  value={job.ticket.eventName}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      ticket: { ...job.ticket!, eventName: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Venue</label>
                <input
                  type="text"
                  value={job.ticket.venue}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      ticket: { ...job.ticket!, venue: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                <input
                  type="text"
                  value={job.ticket.date}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      ticket: { ...job.ticket!, date: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Time</label>
                <input
                  type="text"
                  value={job.ticket.time}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      ticket: { ...job.ticket!, time: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Section</label>
                <input
                  type="text"
                  value={job.ticket.section || ''}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      ticket: { ...job.ticket!, section: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Seat</label>
                <input
                  type="text"
                  value={job.ticket.seat || ''}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      ticket: { ...job.ticket!, seat: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Attendee / Holder</label>
                <input
                  type="text"
                  value={job.ticket.ticketHolder}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      ticket: { ...job.ticket!, ticketHolder: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Barcode Code</label>
                <input
                  type="text"
                  value={job.ticket.barcodeValue}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      ticket: { ...job.ticket!, barcodeValue: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900"
                />
              </div>
            </div>
          </div>
        )}

        {/* 5. PHOTO */}
        {job.type === 'photo' && job.photo && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50">
              <input
                id="photo-file-upload"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <label
                htmlFor="photo-file-upload"
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold cursor-pointer hover:bg-slate-800 transition"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Custom Image to Print</span>
              </label>
              <p className="text-[11px] text-slate-500 mt-2">
                Supported formats: PNG, JPG, WebP. Fits automatically to photo paper.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Caption / Subtitle</label>
                <input
                  type="text"
                  value={job.photo.caption || ''}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      photo: { ...job.photo!, caption: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Border Framing</label>
                <select
                  value={job.photo.borderStyle}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      photo: {
                        ...job.photo!,
                        borderStyle: e.target.value as 'none' | 'thin-white' | 'polaroid',
                      },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                >
                  <option value="polaroid">Classic Polaroid Frame</option>
                  <option value="thin-white">Thin White Border</option>
                  <option value="none">Borderless Edge-to-Edge</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 6. NOTE & CHECKLIST */}
        {job.type === 'note' && job.note && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Heading</label>
              <input
                type="text"
                value={job.note.heading}
                onChange={(e) =>
                  onUpdateJob({
                    ...job,
                    note: { ...job.note!, heading: e.target.value },
                  })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Body Text</label>
              <textarea
                rows={4}
                value={job.note.body}
                onChange={(e) =>
                  onUpdateJob({
                    ...job,
                    note: { ...job.note!, body: e.target.value },
                  })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900"
              />
            </div>
          </div>
        )}

        {/* 7. WEBPAGE / LINK */}
        {job.type === 'webpage' && job.webpage && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Article or Web Link URL</label>
              <input
                type="url"
                value={job.webpage.url}
                onChange={(e) =>
                  onUpdateJob({
                    ...job,
                    webpage: { ...job.webpage!, url: e.target.value },
                  })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900"
                placeholder="https://example.com/article"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Article Title</label>
                <input
                  type="text"
                  value={job.webpage.pageTitle}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      webpage: { ...job.webpage!, pageTitle: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Domain Source</label>
                <input
                  type="text"
                  value={job.webpage.sourceDomain}
                  onChange={(e) =>
                    onUpdateJob({
                      ...job,
                      webpage: { ...job.webpage!, sourceDomain: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Summary to Print</label>
              <textarea
                rows={4}
                value={job.webpage.summary}
                onChange={(e) =>
                  onUpdateJob({
                    ...job,
                    webpage: { ...job.webpage!, summary: e.target.value },
                  })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
