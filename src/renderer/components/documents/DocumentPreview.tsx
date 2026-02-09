import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  X,
  ChevronLeft,
  ChevronRight,
  FolderInput,
  Download,
  ExternalLink,
  FolderSearch,
  Trash2,
  FileText,
  Image,
  File,
} from 'lucide-react';
import type { DocumentRecord } from '../../../shared/types';
import { relativeTime, formatBytes } from '../../lib/format';
import * as ipc from '../../lib/ipc';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface DocumentPreviewProps {
  document: DocumentRecord;
  onClose: () => void;
  onFile: () => void;
  onDelete: () => void;
}

export function DocumentPreview({ document: doc, onClose, onFile, onDelete }: DocumentPreviewProps) {
  const [protocolUrl, setProtocolUrl] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<{ data: Uint8Array } | null>(null);

  useEffect(() => {
    ipc.getDocumentProtocolUrl(doc.id).then(setProtocolUrl);
  }, [doc.id]);

  useEffect(() => {
    if (doc.mime_type !== 'application/pdf') return;
    setPdfData(null);
    ipc.readDocumentFile(doc.id).then((buffer) => {
      if (buffer) setPdfData({ data: new Uint8Array(buffer) });
    });
  }, [doc.id, doc.mime_type]);

  const handleExport = () => ipc.exportDocument(doc.id);
  const handleReveal = () => ipc.revealInFinder(doc.id);
  const handleOpenExternally = () => ipc.openDocumentExternally(doc.id);

  const isPdf = doc.mime_type === 'application/pdf';
  const isImage = doc.mime_type.startsWith('image/');

  return (
    <div className="flex h-full w-[420px] shrink-0 flex-col border-l border-border bg-base">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{doc.original_filename}</p>
          <p className="mt-0.5 text-xs text-faint">
            {relativeTime(doc.added_at)} &middot; {formatBytes(doc.size_bytes)}
            {doc.category && <span className="ml-1">&middot; {doc.category}</span>}
          </p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-lg p-1 text-faint transition-colors hover:bg-elevated hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto">
        {isPdf && pdfData ? (
          <PdfPreview file={pdfData} />
        ) : isImage && protocolUrl ? (
          <ImagePreview url={protocolUrl} alt={doc.original_filename} />
        ) : (
          <UnsupportedPreview document={doc} onOpen={handleOpenExternally} />
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-1 border-t border-border px-3 py-2">
        <ActionButton icon={FolderInput} label="File to..." onClick={onFile} />
        <ActionButton icon={Download} label="Export" onClick={handleExport} />
        <ActionButton icon={ExternalLink} label="Open" onClick={handleOpenExternally} />
        <ActionButton icon={FolderSearch} label="Reveal" onClick={handleReveal} />
        <div className="flex-1" />
        <ActionButton icon={Trash2} label="Delete" onClick={onDelete} danger />
      </div>
    </div>
  );
}

function PdfPreview({ file }: { file: { data: Uint8Array } }) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);

  return (
    <div className="flex flex-col items-center">
      <Document
        file={file}
        onLoadSuccess={({ numPages: n }) => setNumPages(n)}
        loading={<PreviewLoading />}
        error={<PreviewError message="Failed to load PDF" />}
      >
        <Page
          pageNumber={currentPage}
          width={380}
          loading={<PreviewLoading />}
        />
      </Document>

      {numPages > 1 && (
        <div className="sticky bottom-0 flex items-center gap-2 bg-base/90 py-2 backdrop-blur-sm">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="rounded p-1 text-faint transition-colors hover:bg-elevated hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs tabular-nums text-muted">
            {currentPage} / {numPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className="rounded p-1 text-faint transition-colors hover:bg-elevated hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function ImagePreview({ url, alt }: { url: string; alt: string }) {
  return (
    <div className="flex items-center justify-center p-4">
      <img src={url} alt={alt} className="max-h-[60vh] max-w-full rounded-lg object-contain" />
    </div>
  );
}

function UnsupportedPreview({
  document: doc,
  onOpen,
}: {
  document: DocumentRecord;
  onOpen: () => void;
}) {
  const Icon = doc.mime_type === 'application/pdf'
    ? FileText
    : doc.mime_type.startsWith('image/')
      ? Image
      : File;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <Icon className="h-16 w-16 text-dim" />
      <div className="text-center">
        <p className="text-sm font-medium text-secondary">{doc.original_filename}</p>
        <p className="mt-1 text-xs text-faint">
          {doc.mime_type} &middot; {formatBytes(doc.size_bytes)}
        </p>
      </div>
      <button
        onClick={onOpen}
        className="flex items-center gap-2 rounded-lg bg-elevated px-4 py-2 text-sm text-secondary transition-colors hover:bg-highlight hover:text-foreground"
      >
        <ExternalLink className="h-4 w-4" />
        Open in Default App
      </button>
    </div>
  );
}

function PreviewLoading() {
  return (
    <div className="flex h-48 items-center justify-center">
      <p className="text-xs text-faint">Loading...</p>
    </div>
  );
}

function PreviewError({ message }: { message: string }) {
  return (
    <div className="flex h-48 items-center justify-center">
      <p className="text-xs text-danger">{message}</p>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`rounded-lg p-2 text-xs transition-colors ${
        danger
          ? 'text-faint hover:bg-danger/10 hover:text-danger'
          : 'text-faint hover:bg-elevated hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
