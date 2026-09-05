import { PrintJob } from '../types';

export const SAMPLE_JOBS: Record<string, PrintJob> = {
  document: {
    id: 'doc-agreement-1',
    title: 'Consulting Service Agreement',
    createdAt: new Date().toISOString(),
    type: 'document',
    paperSize: 'letter',
    orientation: 'portrait',
    colorMode: 'color',
    autoTrigger: true,
    fontScale: 'md',
    document: {
      header: 'SERVICE AGREEMENT & MEMORANDUM',
      subtitle: 'Project Milestone Completion & Sign-off Notice',
      author: 'Apex Strategy Partners LLC',
      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      content: `1. PURPOSE OF ENGAGEMENT
This document serves as formal confirmation of the deliverables completed under Statement of Work #2026-B. Both parties acknowledge receipt and satisfaction with the preliminary architectural audit and prototype delivery.

2. SUMMARY OF DELIVERABLES
• Comprehensive Cloud Architecture Assessment
• Mobile Direct Print Integration & Native Spooler Setup
• Security Audit & Access Control Verification
• High-performance QR Code Dispatch Infrastructure

3. ACCEPTANCE & WARRANTY
The Client has inspected all milestones and hereby accepts the system deliverables. Ongoing support is maintained in accordance with the Master Service Agreement. Any additional operational requests outside this schedule will be processed under standard ad-hoc support tier rates.`,
      showSignatureLine: true,
      signatureLabel: 'Authorized Representative Signature',
    },
  },

  receipt: {
    id: 'rec-cafe-102',
    title: 'Cafe Bluebird Order #842',
    createdAt: new Date().toISOString(),
    type: 'receipt',
    paperSize: 'receipt-80mm',
    orientation: 'portrait',
    colorMode: 'grayscale',
    autoTrigger: true,
    fontScale: 'md',
    receipt: {
      merchantName: 'BLUEBIRD ARTISAN ROASTERS',
      merchantAddress: '428 Hawthorne Ave, Portland OR',
      merchantPhone: '(503) 555-0194',
      receiptNumber: 'INV-2026-0842',
      date: new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }),
      items: [
        { id: '1', name: 'Oat Milk Flat White (12oz)', qty: 2, price: 5.50 },
        { id: '2', name: 'Almond Croissant (Warm)', qty: 1, price: 4.75 },
        { id: '3', name: 'Single Origin Espresso Shot', qty: 1, price: 3.50 },
        { id: '4', name: 'Avocado Tartine w/ Microgreens', qty: 1, price: 11.00 },
      ],
      taxPercent: 8.5,
      tipAmount: 4.50,
      paymentMethod: 'Apple Pay (AirPrint Direct)',
      barcodeValue: '9842017349182',
      footerNote: 'Thank you for your visit! Follow us @bluebirdcoffee. Please retain for your records.',
    },
  },

  label: {
    id: 'lbl-ship-404',
    title: 'Priority 2-Day Shipping Label',
    createdAt: new Date().toISOString(),
    type: 'label',
    paperSize: 'label-4x6',
    orientation: 'portrait',
    colorMode: 'high-contrast',
    autoTrigger: true,
    fontScale: 'md',
    label: {
      carrier: 'GLOBAL EXPRESS POST',
      serviceType: 'PRIORITY 2-DAY AIR',
      trackingNumber: 'GEP-8492-7104-9218',
      senderName: 'Vanguard Logistics Fulfillment Hub',
      senderAddress: '1200 Industrial Parkway, Suite 400\nSeattle, WA 98101',
      recipientName: 'Elena Rostova',
      recipientAddress: '742 Evergreen Terrace, Apt 3B\nAustin, TX 78704',
      weight: '2.4 LBS',
      notes: 'FRAGILE - HANDLE WITH CARE - LEAVE AT FRONT DOOR IF NO ANSWER',
      packageType: 'Rigid Parcel Box #2',
    },
  },

  ticket: {
    id: 'tkt-symphony-91',
    title: 'City Symphony Hall Admission',
    createdAt: new Date().toISOString(),
    type: 'ticket',
    paperSize: 'letter',
    orientation: 'landscape',
    colorMode: 'color',
    autoTrigger: true,
    fontScale: 'md',
    ticket: {
      eventName: 'PHILHARMONIA: TCHAIKOVSKY & GLASS',
      venue: 'Metropolitan Arts Auditorium - Main Stage',
      date: 'Saturday, October 17, 2026',
      time: '7:30 PM (Doors open 6:45 PM)',
      gate: 'North Rotunda',
      section: 'Orchestra Row D',
      seat: 'Seat 14',
      ticketHolder: 'Marcus Vance',
      ticketType: 'VIP General Admission + Program',
      barcodeValue: 'TKT-2026-PHIL-849102',
      admissionNote: 'Please present this printed ticket or mobile pass at door. No flash photography.',
    },
  },

  photo: {
    id: 'pht-coastal-1',
    title: 'Pacific Coastline View',
    createdAt: new Date().toISOString(),
    type: 'photo',
    paperSize: 'photo-4x6',
    orientation: 'landscape',
    colorMode: 'color',
    autoTrigger: false,
    fontScale: 'md',
    photo: {
      imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
      caption: 'Big Sur Highway 1 Vista • Late Afternoon Fog Clearing • Pacific Crest',
      aspectRatio: 'standard',
      fitMode: 'fill',
      borderStyle: 'polaroid',
    },
  },

  note: {
    id: 'note-kitchen-1',
    title: 'Quick Checklist & Prep Notes',
    createdAt: new Date().toISOString(),
    type: 'note',
    paperSize: 'letter',
    orientation: 'portrait',
    colorMode: 'color',
    autoTrigger: true,
    fontScale: 'md',
    note: {
      heading: 'Event Production Checklist - Friday Setup',
      body: `Reminder: Print this sheet and clip it to the clipboard at the registration desk. Ensure all sound check cables are taped down with gaffer tape before the 4:00 PM safety walkthrough.`,
      isChecklist: true,
      checklistItems: [
        { id: '1', text: 'Calibrate primary projector and verify HDMI signal', done: true },
        { id: '2', text: 'Stage 12 wireless microphones and test fresh AA batteries', done: true },
        { id: '3', text: 'Print 150 name badges and alphabetize on welcome table', done: false },
        { id: '4', text: 'Confirm catering drop-off time with banquet manager', done: false },
        { id: '5', text: 'Sync emergency exit maps and first aid station keys', done: false },
      ],
    },
  },
};
