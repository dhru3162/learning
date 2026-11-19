"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<{
    importId: string;
    message: string;
    status: string;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file: File) => {
    setErrorMessage(null);
    setUploadSuccess(null);

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setErrorMessage("Invalid file type. Please select an .xlsx file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("File size exceeds the 10 MB limit.");
      return;
    }

    setSelectedFile(file);
  };

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
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMessage("Please select an Excel (.xlsx) file first.");
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(`${API_BASE_URL}/users/import`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Upload failed");
      }

      setUploadSuccess(data);
      // Automatically redirect to tracking page after 1.5 seconds
      setTimeout(() => {
        router.push(`/import/${data.importId}`);
      }, 1500);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setErrorMessage(
        err.message || "Failed to connect to backend server on port 3001",
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Bulk Excel User Import
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
          Upload thousands of user records asynchronously. BullMQ workers
          process the file in background batches without blocking your web
          server.
        </p>
      </div>

      {/* Upload Box Card */}
      <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6">
        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 scale-[0.99]"
              : "border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx"
            className="hidden"
          />

          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <svg
                className="w-7 h-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {selectedFile
                  ? selectedFile.name
                  : "Click to select or drag & drop .xlsx file"}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {selectedFile
                  ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                  : "Microsoft Excel files (.xlsx) up to 10 MB"}
              </p>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400">
            <svg
              className="w-5 h-5 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Alert */}
        {uploadSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start justify-between gap-3 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300">
            <div className="space-y-1">
              <p className="font-semibold">{uploadSuccess.message}</p>
              <p className="text-xs">
                Import ID:{" "}
                <span className="font-mono font-bold">
                  {uploadSuccess.importId}
                </span>{" "}
                • Redirecting to live tracker...
              </p>
            </div>
            <Link
              href={`/import/${uploadSuccess.importId}`}
              className="text-xs font-bold underline whitespace-nowrap"
            >
              Track Now →
            </Link>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          className={`w-full py-3.5 px-6 rounded-xl font-semibold text-white shadow-lg transition-all duration-200 flex items-center justify-center gap-2 ${
            !selectedFile || isUploading
              ? "bg-slate-300 dark:bg-slate-800 cursor-not-allowed shadow-none text-slate-500"
              : "bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] shadow-indigo-500/25"
          }`}
        >
          {isUploading ? (
            <>
              <svg
                className="animate-spin w-5 h-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                ></path>
              </svg>
              <span>Uploading & Enqueueing...</span>
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              <span>Start Asynchronous Import</span>
            </>
          )}
        </button>
      </div>

      {/* Expected Format Guide */}
      <div className="max-w-2xl mx-auto bg-slate-100/70 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200/80 dark:border-slate-800 space-y-4">
        <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <svg
            className="w-4 h-4 text-indigo-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Required Excel Header Columns
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-300 dark:border-slate-700 text-slate-500">
                <th className="py-2 px-3 font-semibold">Column</th>
                <th className="py-2 px-3 font-semibold">Rule</th>
                <th className="py-2 px-3 font-semibold">Example</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              <tr>
                <td className="py-2 px-3 font-mono font-medium text-indigo-600 dark:text-indigo-400">
                  Name
                </td>
                <td className="py-2 px-3">Required non-empty string</td>
                <td className="py-2 px-3">Rahul Sharma</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-mono font-medium text-indigo-600 dark:text-indigo-400">
                  Email
                </td>
                <td className="py-2 px-3">
                  Valid email format, unique in file & DB
                </td>
                <td className="py-2 px-3">rahul@gmail.com</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-mono font-medium text-indigo-600 dark:text-indigo-400">
                  Phone
                </td>
                <td className="py-2 px-3">Must contain exactly 10 digits</td>
                <td className="py-2 px-3">9876543210</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-mono font-medium text-indigo-600 dark:text-indigo-400">
                  Age
                </td>
                <td className="py-2 px-3">Valid positive integer (1 - 150)</td>
                <td className="py-2 px-3">25</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
