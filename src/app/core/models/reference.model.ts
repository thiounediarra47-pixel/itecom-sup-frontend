export interface Reference {
  id?: number;
  refType: 'book' | 'article' | 'website' | 'journal' | 'thesis' | 'conference';
  title: string;
  authors: string;
  year?: string;
  publisher?: string;
  place?: string;
  isbn?: string;
  edition?: string;
  pages?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  doi?: string;
  startPage?: string;
  endPage?: string;
  url?: string;
  accessDate?: string;
  university?: string;
  thesisType?: string;
  collection?: string;
  tags?: string;
  abstract_?: string;
  note?: string;
  language?: string;
  createdAt?: string;
}

export type CitationStyle = 'APA' | 'MLA' | 'Chicago' | 'IEEE' | 'Vancouver';
