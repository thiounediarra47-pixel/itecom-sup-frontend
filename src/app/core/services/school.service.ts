import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { DialogService } from './dialog.service';
import { FileViewerComponent } from '../../shared/components/file-viewer.component';

export interface Enrollment {
  id: number; studentId: number; studentName: string; email: string; phone: string | null;
  matricule: string; academicYear: string; level: string; specialization: string | null;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  registrationFee: number; tuitionFee: number; discount: number; installments: number;
  totalDue: number; paid: number; balance: number; pendingAmount: number; overdue: number; createdAt: string;
}

export interface ScheduleItem { label: string; dueDate: string; amount: number; paid: number; status: 'PAID' | 'PARTIAL' | 'DUE' | 'OVERDUE'; }

export interface Payment {
  id: number; enrollmentId: number; studentName: string; matricule: string; level: string; academicYear: string;
  amount: number; purpose: 'INSCRIPTION' | 'SCOLARITE'; method: string; phone: string | null; transactionRef: string | null;
  status: 'PENDING' | 'VALIDATED' | 'REJECTED'; receiptNumber: string | null; rejectionReason: string | null;
  processedBy: string | null; submittedAt: string; processedAt: string | null;
}

export interface GradeLine { subject: string; coefficient: number; normale: number | null; rattrapage: number | null; effective: number; published: boolean; comment: string | null; }
export interface SemesterView { semester: string; lines: GradeLine[]; average: number | null; }
export interface Transcript { semesters: SemesterView[]; annualAverage: number | null; decision: string | null; mention: string | null; }

export interface Certificate {
  id: number; enrollmentId: number; studentName: string; matricule: string; level: string; academicYear: string;
  type: string; typeLabel: string; reference: string; verificationCode: string; verifyUrl: string;
  average: number | null; mention: string | null; issuedAt: string; issuedBy: string | null; revoked: boolean;
}

/** Montants d'un niveau pour une année : inscription et mensualité. */
export interface Fee {
  id: number; academicYear: string; level: string; registrationFee: number; monthlyFee: number; months: number; annualTotal: number;
}

export interface SchoolDocument { id: number; type: string; typeLabel: string; originalName: string; size: number; uploadedAt: string; }

export interface EnrollmentFile {
  enrollment: Enrollment; schedule: ScheduleItem[]; payments: Payment[]; transcript: Transcript; certificates: Certificate[];
  documents: SchoolDocument[];
}

export interface Admission { enrollment: Enrollment; emailSent: boolean; message: string; password: string; }

export interface SheetRow { enrollmentId: number; studentName: string; matricule: string; grade: number | null; comment: string | null; published: boolean; }

export interface SchoolStats {
  academicYear: string; students: number; active: number; pendingEnrollments: number;
  expected: number; collected: number; remaining: number; overdue: number; overdueStudents: number; collectionRate: number;
  pendingPayments: number; pendingAmount: number; certificates: number;
  byLevel: { level: string; students: number; expected: number; collected: number; unpaidStudents: number }[];
  byMethod: Record<string, number>;
}

export const LEVELS = ['L1', 'L2', 'L3', 'M1', 'M2'];

export const SPECIALIZATIONS: Record<string, string> = {
  'genie-logiciel': 'Génie Logiciel',
  'reseau': 'Réseaux et Télécoms',
  'comptabilite': 'Comptabilité et Gestion',
  'sante': 'Sciences de la Santé',
  'marketing-digital': 'Marketing Digital',
  'developpement-personnel': 'Développement Personnel'
};

export const METHOD_LABELS: Record<string, string> = {
  WAVE: 'Wave', ORANGE_MONEY: 'Orange Money', FREE_MONEY: 'Free Money',
  ESPECES: 'Espèces', VIREMENT: 'Virement bancaire', CHEQUE: 'Chèque'
};

export const ENROLLMENT_STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: 'En attente', tone: 'warn' },
  ACTIVE: { label: 'Active', tone: 'ok' },
  SUSPENDED: { label: 'Suspendue', tone: 'danger' },
  CANCELLED: { label: 'Annulée', tone: 'muted' }
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: 'À vérifier', tone: 'warn' },
  VALIDATED: { label: 'Validé', tone: 'ok' },
  REJECTED: { label: 'Refusé', tone: 'danger' }
};

export const SCHEDULE_STATUS: Record<string, { label: string; tone: string }> = {
  PAID: { label: 'Payée', tone: 'ok' },
  PARTIAL: { label: 'Partielle', tone: 'warn' },
  DUE: { label: 'À venir', tone: 'muted' },
  OVERDUE: { label: 'En retard', tone: 'danger' }
};

export const CERTIFICATE_TYPES: Record<string, string> = {
  INSCRIPTION: "Attestation d'inscription",
  SCOLARITE: 'Certificat de scolarité',
  REUSSITE: 'Attestation de réussite',
  RELEVE_NOTES: 'Relevé de notes'
};

/** 150000 → « 150 000 FCFA ». */
export function fcfa(amount: number | null | undefined): string {
  return `${Math.round(amount ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;
}

/** Message d'erreur renvoyé par l'API ({ message }) ou message par défaut. */
export function apiError(err: any, fallback = 'Une erreur est survenue.'): string {
  return err?.error?.message || fallback;
}

@Injectable({ providedIn: 'root' })
export class SchoolService {
  private readonly admin = '/api/admin/scolarite';

  constructor(private http: HttpClient, private dialogs: DialogService) {}

  // Administration
  options() { return this.http.get<{ currentYear: string; levels: string[]; methods: string[] }>(`${this.admin}/options`); }
  stats(year: string) { return this.http.get<SchoolStats>(`${this.admin}/stats`, { params: { year } }); }
  fees(year: string) { return this.http.get<{ months: number; fees: Fee[] }>(`${this.admin}/fees`, { params: { year } }); }
  saveFee(body: { academicYear: string; level: string; registrationFee: number; monthlyFee: number }) {
    return this.http.put<Fee>(`${this.admin}/fees`, body);
  }
  deleteFee(id: number) { return this.http.delete(`${this.admin}/fees/${id}`); }
  enrollments(year: string) { return this.http.get<Enrollment[]>(`${this.admin}/enrollments`, { params: { year } }); }
  enrollmentFile(id: number) { return this.http.get<EnrollmentFile>(`${this.admin}/enrollments/${id}`); }
  /** Nouvel étudiant : identité, inscription et pièces PDF (multipart). */
  admit(body: FormData) { return this.http.post<Admission>(`${this.admin}/enrollments/new`, body); }
  enrollLevel(academicYear: string, level: string) { return this.http.post<{ created: number; errors: string[] }>(`${this.admin}/enrollments/level`, { academicYear, level }); }
  updateEnrollment(id: number, body: any) { return this.http.put<Enrollment>(`${this.admin}/enrollments/${id}`, body); }
  deleteEnrollment(id: number) { return this.http.delete(`${this.admin}/enrollments/${id}`); }
  payments(status = '') { return this.http.get<Payment[]>(`${this.admin}/payments`, { params: status ? { status } : {} }); }
  recordPayment(body: any) { return this.http.post<Payment>(`${this.admin}/payments`, body); }
  validatePayment(id: number) { return this.http.post<Payment>(`${this.admin}/payments/${id}/validate`, {}); }
  rejectPayment(id: number, reason: string) { return this.http.post<Payment>(`${this.admin}/payments/${id}/reject`, { reason }); }
  subjects(year: string, level: string) { return this.http.get<string[]>(`${this.admin}/grades/subjects`, { params: { year, level } }); }
  gradeSheet(p: { year: string; level: string; semester: string; subject: string; session: string }) {
    return this.http.get<{ coefficient: number | null; rows: SheetRow[] }>(`${this.admin}/grades`, { params: new HttpParams({ fromObject: p }) });
  }
  saveGradeSheet(body: any) { return this.http.put<{ saved: number }>(`${this.admin}/grades`, body); }
  publishGrades(academicYear: string, level: string, semester: string) {
    return this.http.post<{ published: number }>(`${this.admin}/grades/publish`, { academicYear, level, semester });
  }
  certificates() { return this.http.get<Certificate[]>(`${this.admin}/certificates`); }
  issueCertificate(enrollmentId: number, type: string) { return this.http.post<Certificate>(`${this.admin}/certificates`, { enrollmentId, type }); }
  revokeCertificate(id: number) { return this.http.post<Certificate>(`${this.admin}/certificates/${id}/revoke`, {}); }
  sendReminders(academicYear: string) { return this.http.post<{ sent: number }>(`${this.admin}/reminders`, { academicYear }); }
  broadcast(body: any) { return this.http.post<{ sent: number }>(`${this.admin}/broadcast`, body); }

  // Étudiant
  mySchooling() { return this.http.get<{ enrollments: Omit<EnrollmentFile, 'documents'>[]; paymentNumbers: Record<string, string> }>('/api/scolarite/me'); }
  pay(body: any) { return this.http.post<Payment>('/api/scolarite/payments', body); }

  // Vérification publique
  verify(code: string) { return this.http.get<any>(`/api/public/verify/${encodeURIComponent(code)}`); }

  /** Ouvre un PDF protégé (reçu, attestation) dans la visionneuse, sans quitter la page. */
  openPdf(url: string, name: string) {
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: blob => {
        const objectUrl = URL.createObjectURL(blob);
        const ref = this.dialogs.open(FileViewerComponent, { title: name, icon: 'bi-file-earmark-pdf', size: 'xl', data: { url: objectUrl, name: `${name}.pdf`, kind: 'pdf' } });
        ref.afterClosed.then(() => URL.revokeObjectURL(objectUrl));
      },
      error: async err => {
        // Le corps d'erreur d'une requête « blob » est lui-même un blob
        let message = 'Document indisponible.';
        try { message = JSON.parse(await (err.error as Blob).text()).message || message; } catch { }
        this.dialogs.toast(message, 'danger', 5000);
      }
    });
  }
}

