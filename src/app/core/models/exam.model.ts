export interface ExamQuestion {
  id: number;
  questionText: string;
  maxScore: number;
  orderIndex: number;
}

export interface ExamQuestionForm {
  questionText: string;
  referenceAnswer: string;
  maxScore: number;
}

export interface ExamStudent {
  id: number;
  studentName: string;
  studentEmail: string;
  status: 'INVITED' | 'STARTED' | 'SUBMITTED' | 'GRADED';
  totalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  aiReport: string | null;
  submissionType: 'ONLINE' | 'SCANNED_COPY' | null;
}

export interface Exam {
  id: number;
  title: string;
  description: string;
  professorName: string;
  estimatedDurationMinutes: number | null;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  questionCount: number;
  studentCount: number;
  targetLevels?: string[];
  createdAt: string;
  questions: ExamQuestion[];
  students: ExamStudent[];
}

export interface ExamCreateRequest {
  title: string;
  description: string;
  estimatedDurationMinutes: number;
  questions: ExamQuestionForm[];
  targetLevels?: string[];
}

export interface ExamTakeResponse {
  examId: number;
  examTitle: string;
  examDescription: string;
  studentName: string;
  studentEmail: string;
  status: string;
  questions: ExamQuestion[];
  gradingDelayMinutes: number;
  resultsLocked: boolean;
  resultsAvailableAt: string | null;
}

export interface StudentAnswer {
  questionId: number;
  answer: string;
}

export interface ExamSubmitRequest {
  answers: StudentAnswer[];
}

export interface ExamAnswerDetail {
  questionId: number;
  orderIndex: number;
  questionText: string;
  referenceAnswer: string;
  maxScore: number;
  studentAnswer: string | null;
  obtainedScore: number | null;
  aiComment: string | null;
}

export interface StudentExam {
  examId: number;
  examTitle: string;
  examDescription: string;
  professorName: string;
  examStatus: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  studentStatus: 'INVITED' | 'STARTED' | 'SUBMITTED' | 'GRADED';
  accessToken: string;
  totalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  createdAt: string;
}

export interface ExamSubmissionDetail {
  studentId: number;
  studentName: string;
  studentEmail: string;
  status: string;
  submissionType: 'ONLINE' | 'SCANNED_COPY';
  scannedFileUrls: string[];
  totalScore: number | null;
  maxScore: number | null;
  aiReport: string | null;
  answers: ExamAnswerDetail[];
}
