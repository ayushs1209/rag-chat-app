import React, { useRef, useState } from 'react';
import { UploadCloud, FileType } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf') {
        onFileSelect(file);
      } else {
        alert('Please upload a PDF file.');
      }
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative overflow-hidden rounded-xl border border-dashed cursor-pointer transition-all duration-300 group
        ${isDragging 
          ? 'border-white bg-zinc-800 scale-[1.02]' 
          : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50'
        }
      `}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleChange}
        accept="application/pdf"
        className="hidden"
      />
      
      <div className="p-12 flex flex-col items-center justify-center text-center">
        <div className={`
          p-4 rounded-full mb-5 transition-colors duration-300
          ${isDragging ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-white'}
        `}>
          <UploadCloud className="w-8 h-8" />
        </div>
        
        <h3 className="text-lg font-medium text-white mb-2">
          Upload PDF
        </h3>
        
        <p className="text-zinc-500 text-sm max-w-xs mx-auto mb-6">
          Drag and drop or click to browse
        </p>

        <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest border border-zinc-800 px-3 py-1 rounded-full">
          <FileType className="w-3 h-3" />
          <span>PDF Supported</span>
        </div>
      </div>
    </div>
  );
};