export interface Book {
  id: number;
  title: string;
  author: string;
  description: string;
  coverUrl?: string;
  fileUrl?: string;
  category: string;
  genre: string;
  language: string;
  year?: number;
  pages?: number;
  publisher?: string;
  isbn?: string;
  externalReadUrl?: string;
  available: boolean;
  hasFile: boolean;
  hasExternalRead?: boolean;
  addedAt?: string;
}
