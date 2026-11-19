'use client';

import { useEffect, useState, use, Suspense } from 'react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ImportStatusResponse {
  importId: string;
  fileName: string;
  totalRecords: number;
  processedRecords: number;
  successRecords: number;
  failedRecords: number;
  currentStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  createdAt: string;
  updatedAt: string;
}

interface FailedRecord {
  id: string;
  rowNumber: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  age: string | null;
  errorReason: string;
  createdAt: string;
}

export default function ImportProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium text-sm">Loading import job details...</p>
        </div>
      }
    >
      <ImportProgressContent id={id} />
    </Suspense>
  );
}

function ImportProgressContent({ id }: { id: string }) {

  const [statusData, setStatusData] = useState<ImportStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Failed records state
  const [failedRecords, setFailedRecords] = useState<FailedRecord[]>([]);
  const [failedPage, setFailedPage] = useState(1);
  const [failedTotalPages, setFailedTotalPages] = useState(1);
  const [loadingErrors, setLoadingErrors] = useState(false);

  // Poll status every 1.5 seconds while job is active
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/users/import/${id}/status`);
        if (!res.ok) {
          throw new Error('Failed to fetch import job status');
        }
        const data: ImportStatusResponse = await res.json();
        setStatusData(data);
        setLoading(false);

        // If completed or failed, stop polling
        if (data.currentStatus === 'COMPLETED' || data.currentStatus === 'FAILED') {
          clearInterval(interval);
        }
      } catch (err: any) {
        setError(err.message || 'Error communicating with server');
        setLoading(false);
        clearInterval(interval);
      }
    };

    fetchStatus();
    interval = setInterval(fetchStatus, 1500);

    return () => clearInterval(interval);
  }, [id]);

  // Fetch failed records if there are any failures
  useEffect(() => {
    if (statusData && statusData.failedRecords > 0) {
      const fetchFailed = async () => {
        setLoadingErrors(true);
        try {
          const res = await fetch(
            `${API_BASE_URL}/users/import/${id}/failed-records?page=${failedPage}&limit=10`,
          );
          if (res.ok) {
            const data = await res.json();
            setFailedRecords(data.data || []);
            setFailedTotalPages(data.pagination?.totalPages || 1);
          }
        } catch {
          // Non-critical error
        } finally {
          setLoadingErrors(false);
        }
      };

      fetchFailed();
    }
  }, [id, statusData?.failedRecords, failedPage]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium text-sm">Loading import job details...</p>
      </div>
    );
  }

  if (error || !statusData) {
    return (
      <div className="max-w-xl mx-auto p-8 bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950 text-red-600 mx-auto flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Unable to find Import Job</h2>
        <p className="text-sm text-slate-500">{error || `Job ${id} could not be loaded.`}</p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700"
        >
          ← Return to Upload
        </Link>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
            ⏳ Waiting in Queue
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800 animate-pulse flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Processing Batches
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
            ✓ Completed
          </span>
        );
      case 'FAILED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
            ✕ Failed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xl sm:text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
                {statusData.importId}
              </span>
              {getStatusBadge(statusData.currentStatus)}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              File: <span className="font-medium text-slate-700 dark:text-slate-300">{statusData.fileName}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-4 py-2 text-xs sm:text-sm font-medium rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              + Upload Another
            </Link>
            <Link
              href="/history"
              className="px-4 py-2 text-xs sm:text-sm font-medium rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200"
            >
              View History
            </Link>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-slate-600 dark:text-slate-400">Overall Progress</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-mono text-sm">
              {statusData.progress}%
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-3.5 rounded-full overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                statusData.currentStatus === 'FAILED'
                  ? 'bg-red-500'
                  : statusData.currentStatus === 'COMPLETED'
                    ? 'bg-emerald-500'
                    : 'bg-indigo-600'
              }`}
              style={{ width: `${statusData.progress}%` }}
            ></div>
          </div>
        </div>

        {/* 4 Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-500">Total Records</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-mono">
              {statusData.totalRecords.toLocaleString()}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Processed</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1 font-mono">
              {statusData.processedRecords.toLocaleString()}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Successful Users</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1 font-mono">
              {statusData.successRecords.toLocaleString()}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40">
            <p className="text-xs font-medium text-red-600 dark:text-red-400">Failed Records</p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1 font-mono">
              {statusData.failedRecords.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Failed Records Section */}
      {statusData.failedRecords > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/50 p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                Invalid Records & Errors ({statusData.failedRecords})
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                These records failed validation or contained duplicate emails and were skipped.
              </p>
            </div>

            {/* API 5: Download Failed Records Excel */}
            <a
              href={`${API_BASE_URL}/users/import/${id}/download-failed`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-xs shadow-md shadow-red-500/20 transition-all self-start sm:self-auto"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Failed Rows (.xlsx)
            </a>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="py-3 px-4">Row #</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Age</th>
                  <th className="py-3 px-4">Failure Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {loadingErrors ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Loading failed records...
                    </td>
                  </tr>
                ) : failedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No errors loaded.
                    </td>
                  </tr>
                ) : (
                  failedRecords.map((err) => (
                    <tr key={err.id} className="hover:bg-red-50/30 dark:hover:bg-red-950/10">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                        {err.rowNumber}
                      </td>
                      <td className="py-3 px-4">{err.name || '—'}</td>
                      <td className="py-3 px-4 font-mono">{err.email || '—'}</td>
                      <td className="py-3 px-4 font-mono">{err.phone || '—'}</td>
                      <td className="py-3 px-4">{err.age || '—'}</td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2.5 py-1 rounded-md text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                          {err.errorReason}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {failedTotalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
              <span>
                Page {failedPage} of {failedTotalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setFailedPage((p) => Math.max(1, p - 1))}
                  disabled={failedPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setFailedPage((p) => Math.min(failedTotalPages, p + 1))}
                  disabled={failedPage === failedTotalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
