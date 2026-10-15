export interface Annotation {
  id?: number;
  bookId: number;
  pageNumber: number;
  selectedText: string;
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'orange';
  note?: string;
  type: 'HIGHLIGHT' | 'BOOKMARK' | 'NOTE';
  createdAt?: string;
}
