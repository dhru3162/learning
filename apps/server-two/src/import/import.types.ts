/**
 * Import Types and Interfaces
 */

export interface ImportJobData {
  importId: string;
  filePath: string;
  fileName: string;
}

export interface RawExcelRow {
  rowNumber: number;
  name?: string;
  email?: string;
  phone?: string;
  age?: string;
}

export interface ValidUserRecord {
  name: string;
  email: string;
  phone: string;
  age: number;
}

export interface InvalidUserRecord {
  rowNumber: number;
  name?: string;
  email?: string;
  phone?: string;
  age?: string;
  errorReason: string;
}
