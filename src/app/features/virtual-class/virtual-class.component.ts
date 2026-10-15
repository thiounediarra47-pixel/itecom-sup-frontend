import { Component, OnInit } from '@angular/core';
import { PaginatePipe, PaginationComponent, Pager } from '../../shared/components/pagination.component';
import { CommonModule } from '@angular/common';
import { pickVideoUrl } from '../../core/utils/video-quality';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { StudentPickerComponent, PickedStudent, studentsCsv } from '../../shared/components/student-picker.component';

interface VirtualClass {
  id: number;
  title: string;
  description: string;
  scheduledAt: string;
  durationMinutes: number;
  roomName: string;
  recordingUrl: string | null;
  recordingLightUrl?: string | null;
  status: string;
  teacherName: string | null;
  teacherId: number | null;
  courseTitle: string | null;
  thumbnailData: string | null;
  hasRecording: boolean;
}

@Component({
  selector: 'app-virtual-class',
  standalone: true,
  imports: [PaginationComponent, PaginatePipe, CommonModule, RouterLink, FormsModule, StudentPickerComponent],
  template: `
    <div class="fade-in-up">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 class="fw-bold mb-1"><i class="bi bi-camera-video me-1"></i>Classes Virtuelles</h1>
          <p class="text-muted">Rejoignez des sessions en direct avec vos professeurs</p>
        </div>
        <div *ngIf="authService.isTeacher || authService.isAdmin">
          <button class="btn btn-primary-custom" (click)="showCreateModal = true">
            <i class="bi bi-plus-circle me-2"></i>Créer une session
          </button>
        </div>
      </div>

      <!-- Tabs -->
      <ul class="nav nav-pills mb-4">
        <li class="nav-item">
          <button class="nav-link" [class.active]="activeTab === 'upcoming'" (click)="activeTab = 'upcoming'; classesPg.reset()">
            <i class="bi bi-calendar3 me-1"></i>À venir
          </button>
        </li>
        <li class="nav-item">
          <button class="nav-link" [class.active]="activeTab === 'ongoing'" (click)="activeTab = 'ongoing'; classesPg.reset()">
            <i class="bi bi-record-circle me-1"></i>En cours
          </button>
        </li>
        <li class="nav-item">
          <button class="nav-link" [class.active]="activeTab === 'past'" (click)="activeTab = 'past'; classesPg.reset()">
            <i class="bi bi-folder me-1"></i>Passées
          </button>
        </li>
      </ul>

      <!-- Loading -->
      <div *ngIf="loading" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
      </div>

      <!-- Classe list -->
      <div class="row g-4" *ngIf="!loading">
        <div *ngIf="filteredClasses.length === 0" class="col-12 text-center py-5">
          <div style="font-size:4rem"><i class="bi bi-inbox"></i></div>
          <h4 class="mt-3">Aucune classe {{ getTabLabel() }}</h4>
        </div>

        <div class="col-md-6 col-xl-4" *ngFor="let vc of filteredClasses | paginate: classesPg.page : classesPg.size" [id]="'vc-' + vc.id">
          <div class="card border-0 shadow-sm h-100" style="border-radius:16px; overflow:hidden; transition: box-shadow .3s"
               [style.box-shadow]="highlightId === vc.id ? '0 0 0 3px #2b3ea8' : null">
            <!-- Status banner -->
            <div class="p-3 text-white text-center fw-semibold"
                 [style.background]="isOverdue(vc) ? '#94a3b8' : getStatusColor(vc.status)">
              <i class="me-2" [class.bi-clock]="vc.status === 'SCHEDULED' && !isOverdue(vc)"
                 [class.bi-exclamation-circle]="isOverdue(vc)"
                 [class.bi-record-circle]="vc.status === 'ONGOING'"
                 [class.bi-check-circle]="vc.status === 'COMPLETED'"></i>
              {{ isOverdue(vc) ? 'Non tenue' : getStatusLabel(vc.status) }}
            </div>

            <!-- Zone vidéo : toujours visible pour les sessions avec enregistrement -->
            <div *ngIf="vc.hasRecording" style="position:relative; background:#111; height:180px; overflow:hidden; cursor:pointer"
                 (click)="toggleInlinePlay(vc)">

              <!-- Miniature (si disponible) ou placeholder -->
              <ng-container *ngIf="playingVcId !== vc.id">
                <img *ngIf="vc.thumbnailData"
                     [src]="'data:image/jpeg;base64,' + vc.thumbnailData"
                     alt="miniature"
                     style="width:100%; height:100%; object-fit:cover; opacity:0.9; transition:opacity .2s">
                <div *ngIf="!vc.thumbnailData"
                     style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; color:#555">
                  <i class="bi bi-camera-video" style="font-size:2.2rem"></i>
                  <span style="font-size:.75rem">Enregistrement disponible</span>
                </div>
              </ng-container>

              <!-- Lecteur vidéo inline -->
              <video *ngIf="playingVcId === vc.id && playingObjectUrl"
                     [src]="playingObjectUrl"
                     preload="metadata" playsinline
                     (canplay)="onVideoReady($event)"
                     (error)="onVideoError()"
                     (pause)="videoIsPaused = true"
                     (play)="videoIsPaused = false"
                     (ended)="videoIsPaused = true"
                     style="width:100%; height:100%; object-fit:contain; background:#000">
              </video>

              <!-- Spinner de chargement -->
              <div *ngIf="loadingVcId === vc.id"
                   style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.65)">
                <div class="spinner-border text-light"></div>
              </div>

              <!-- Bouton Play / Pause YouTube-style -->
              <div *ngIf="loadingVcId !== vc.id"
                   style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center">
                <div style="background:rgba(0,0,0,.55); border-radius:50%; width:54px; height:54px;
                            display:flex; align-items:center; justify-content:center;
                            transition:background .15s; box-shadow:0 2px 8px rgba(0,0,0,.4)">
                  <i [class]="(playingVcId === vc.id && !videoIsPaused) ? 'bi bi-pause-fill' : 'bi bi-play-fill'"
                     style="color:#fff; font-size:1.5rem; margin-left:2px"></i>
                </div>
              </div>
            </div>

            <div class="card-body p-4">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <h5 class="fw-bold mb-0">{{ vc.title }}</h5>
                <button *ngIf="canDelete(vc)"
                        class="btn btn-sm btn-outline-danger ms-2"
                        title="Supprimer l'enregistrement"
                        (click)="$event.stopPropagation(); confirmDeleteRecording(vc)">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
              <p class="text-muted small mb-3">{{ vc.description }}</p>

              <div class="d-flex flex-column gap-2 small text-muted mb-4">
                <div><i class="bi bi-calendar3 me-2 text-primary"></i>{{ vc.scheduledAt | date:'EEEE d MMMM y':'':'fr' }}</div>
                <div><i class="bi bi-clock me-2 text-primary"></i>{{ vc.scheduledAt | date:'HH:mm' }} · {{ vc.durationMinutes }}min</div>
                <div *ngIf="vc.teacherName"><i class="bi bi-person me-2 text-primary"></i>{{ vc.teacherName }}</div>
                <div *ngIf="vc.courseTitle"><i class="bi bi-book me-2 text-primary"></i>{{ vc.courseTitle }}</div>
              </div>

              <button *ngIf="vc.status === 'ONGOING'"
                      class="btn btn-danger fw-bold w-100"
                      (click)="joinRoom(vc.id)">
                <i class="bi bi-camera-video-fill me-2"></i>Rejoindre maintenant
              </button>
              <button *ngIf="vc.status === 'SCHEDULED' && !isOverdue(vc) && (authService.isTeacher || authService.isAdmin)"
                      class="btn btn-primary fw-bold w-100"
                      (click)="startSession(vc)">
                <i class="bi bi-play-circle me-2"></i>Démarrer la session
              </button>
              <button *ngIf="vc.status === 'SCHEDULED' && !isOverdue(vc) && authService.isStudent" class="btn btn-outline-primary w-100" disabled>
                <i class="bi bi-bell me-2"></i>Rappel activé
              </button>
              <div *ngIf="vc.status === 'SCHEDULED' && isOverdue(vc)" class="d-grid">
                <button *ngIf="authService.isTeacher || authService.isAdmin" class="btn btn-outline-primary w-100" (click)="startSession(vc)">
                  <i class="bi bi-play-circle me-2"></i>Démarrer en retard
                </button>
                <button *ngIf="authService.isStudent" class="btn btn-outline-secondary w-100" disabled>
                  <i class="bi bi-archive me-2"></i>Session non tenue
                </button>
              </div>
              <div *ngIf="vc.status === 'COMPLETED' && !vc.hasRecording" class="d-grid">
                <button class="btn btn-outline-secondary w-100" disabled>
                  <i class="bi bi-archive me-2"></i>Session terminée (sans enregistrement)
                </button>
              </div>
              <a *ngIf="canSeeAttendance(vc) && (vc.status !== 'SCHEDULED' || isOverdue(vc))"
                 [routerLink]="['/virtual-class', vc.id, 'attendance']"
                 class="btn btn-outline-primary w-100 mt-2">
                <i class="bi bi-person-check me-2"></i>Présences et rapport
              </a>
            </div>
          </div>
        </div>
      </div>
      <app-pagination [pager]="classesPg" [total]="filteredClasses.length"></app-pagination>

      <!-- How it works (if empty) -->
      <div *ngIf="!loading && classes.length === 0" class="mt-4">
        <div class="card border-0 bg-light p-5 rounded-4 text-center">
          <h4 class="fw-bold mb-4">Comment fonctionnent les classes virtuelles ?</h4>
          <div class="row g-4">
            <div class="col-md-3" *ngFor="let step of howItWorks">
              <div style="font-size:2.5rem"><i class="bi" [ngClass]="step.icon"></i></div>
              <h6 class="fw-bold mt-2">{{ step.title }}</h6>
              <p class="text-muted small">{{ step.desc }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Create Modal -->
      <div class="modal fade show d-block" *ngIf="showCreateModal" style="background:rgba(0,0,0,.5);overflow-y:auto">
        <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div class="modal-content border-0 rounded-4">
            <div class="modal-header border-0 p-4">
              <h5 class="modal-title fw-bold"><i class="bi bi-calendar-event me-1"></i>Créer une classe virtuelle</h5>
              <button class="btn-close" (click)="showCreateModal = false"></button>
            </div>
            <div class="modal-body p-4">
              <div class="mb-3">
                <label class="form-label fw-semibold">Titre</label>
                <input type="text" class="form-control" [(ngModel)]="newClass.title" placeholder="Ex: Introduction à Java">
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold">Description</label>
                <textarea class="form-control" rows="3" [(ngModel)]="newClass.description"></textarea>
              </div>
              <div class="row g-3 mb-3">
                <div class="col-7">
                  <label class="form-label fw-semibold">Date et heure</label>
                  <input type="datetime-local" class="form-control" [(ngModel)]="newClass.scheduledAt">
                </div>
                <div class="col-5">
                  <label class="form-label fw-semibold">Durée (min)</label>
                  <input type="number" class="form-control" [(ngModel)]="newClass.durationMinutes" value="60">
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold">Étudiants *</label>
                <app-student-picker [students]="newStudents" [targetLevels]="newLevels"></app-student-picker>
                <div *ngIf="createError" class="alert alert-danger py-2 mt-2 mb-0 small">{{ createError }}</div>
              </div>
              <div class="alert alert-info small mb-0">
                <i class="bi bi-info-circle me-1"></i>
                Un salon de visioconférence intégré sera généré automatiquement pour cette session,
                aucun lien externe n'est nécessaire.
              </div>
            </div>
            <div class="modal-footer border-0 p-4 pt-0">
              <button class="btn btn-outline-secondary" (click)="showCreateModal = false">Annuler</button>
              <button class="btn btn-primary-custom" (click)="createClass()">
                <i class="bi bi-check-circle me-2"></i>Créer la session
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Erreur inline player -->
      <div *ngIf="inlineError" class="alert alert-danger mt-3">
        <i class="bi bi-exclamation-circle me-2"></i>{{ inlineError }}
        <button class="btn-close float-end" (click)="inlineError=''"></button>
      </div>

      <!-- Confirm Delete Modal -->
      <div class="modal fade show d-block" *ngIf="deletingRecording" style="background:rgba(0,0,0,.5)">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 rounded-4">
            <div class="modal-body p-4 text-center">
              <div style="font-size:2.5rem"><i class="bi bi-trash3"></i></div>
              <h5 class="fw-bold mt-2">Supprimer l'enregistrement ?</h5>
              <p class="text-muted">Cette action est irréversible. La vidéo sera définitivement supprimée.</p>
              <div class="d-flex gap-2 justify-content-center mt-3">
                <button class="btn btn-outline-secondary" (click)="deletingRecording = null">Annuler</button>
                <button class="btn btn-danger" (click)="deleteRecording()" [disabled]="deleteLoading">
                  <span *ngIf="deleteLoading" class="spinner-border spinner-border-sm me-1"></span>
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class VirtualClassComponent implements OnInit {
  /** Pagination des listes. */
  classesPg = new Pager(9);
  classes: VirtualClass[] = [];
  loading = true;
  activeTab = 'upcoming';
  showCreateModal = false;
  deletingRecording: VirtualClass | null = null;
  deleteLoading = false;
  newClass: any = { title: '', description: '', scheduledAt: '', durationMinutes: 60 };
  newStudents: PickedStudent[] = [];
  newLevels = new Set<string>();
  createError = '';

  // Inline player state
  playingVcId: number | null = null;
  loadingVcId: number | null = null;
  playingObjectUrl: string | null = null;
  videoIsPaused = true;
  inlineError = '';
  private currentVideoEl: HTMLVideoElement | null = null;

  howItWorks = [
    { icon: 'bi-calendar-event', title: 'Planifiez', desc: 'Les professeurs planifient des sessions en direct' },
    { icon: 'bi-camera-video', title: 'Rejoignez', desc: 'La visioconférence est intégrée à la plateforme, en un clic' },
    { icon: '⏺️', title: 'Enregistrez', desc: "Le professeur peut enregistrer la session" },
    { icon: 'bi-folder', title: 'Revoyez', desc: "Le cours enregistré reste disponible dans l'onglet Passées" }
  ];

  get filteredClasses(): VirtualClass[] {
    let now = new Date();
    return this.classes.filter(vc => {
      let date = new Date(vc.scheduledAt);
      if (this.activeTab === 'ongoing') return vc.status === 'ONGOING';
      // « À venir » tant que la séance n'est pas finie ; une fois l'heure de fin passée sans démarrage : « Non tenue » (Passées)
      if (this.activeTab === 'upcoming') return vc.status === 'SCHEDULED' && !this.isOverdue(vc);
      if (this.activeTab === 'past') return vc.status === 'COMPLETED' || this.isOverdue(vc);
      return true;
    });
  }

  /** Séance ouverte depuis le tableau de bord (?session=id), mise en évidence */
  highlightId: number | null = null;

  constructor(private http: HttpClient, private router: Router, private route: ActivatedRoute, public authService: AuthService) {}

  ngOnInit() {
    const params = this.route.snapshot.queryParamMap;
    const tab = params.get('tab');
    if (tab === 'upcoming' || tab === 'ongoing' || tab === 'past') this.activeTab = tab;
    const session = Number(params.get('session')) || null;
    this.http.get<VirtualClass[]>('/api/virtual-classes').subscribe({
      next: (data) => { this.classes = data; this.loading = false; if (session) this.showSession(session); },
      error: () => {
        // Liste vide plutôt que des séances fictives : chacun ne voit que ses propres séances
        this.classes = [];
        this.loading = false;
      }
    });
  }

  /** Ouvre l'onglet et la page de la liste où se trouve la séance, puis la fait défiler à l'écran. */
  private showSession(id: number) {
    const vc = this.classes.find(c => c.id === id);
    if (!vc) return;
    this.activeTab = vc.status === 'ONGOING' ? 'ongoing' : (vc.status === 'COMPLETED' || this.isOverdue(vc)) ? 'past' : 'upcoming';
    const index = this.filteredClasses.findIndex(c => c.id === id);
    this.classesPg.page = Math.floor(Math.max(0, index) / this.classesPg.size) + 1;
    this.highlightId = id;
    setTimeout(() => document.getElementById('vc-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    setTimeout(() => this.highlightId = null, 4000);
  }

  isOverdue(vc: VirtualClass): boolean {
    if (vc.status !== 'SCHEDULED') return false;
    const end = new Date(vc.scheduledAt).getTime() + (vc.durationMinutes || 0) * 60000;
    return end < Date.now();
  }

  /** Rapport de présence : professeur de la séance ou administrateur. */
  canSeeAttendance(vc: VirtualClass): boolean {
    if (this.authService.isAdmin) return true;
    const currentUserId = this.authService.currentUser?.id;
    return !!(this.authService.isTeacher && currentUserId && vc.teacherId === currentUserId);
  }

  canDelete(vc: VirtualClass): boolean {
    if (!vc.hasRecording) return false;
    if (this.authService.isAdmin) return true;
    const currentUserId = this.authService.currentUser?.id;
    return !!(this.authService.isTeacher && currentUserId && vc.teacherId === currentUserId);
  }

  getTabLabel() { return { upcoming: 'à venir', ongoing: 'en cours', past: 'passée' }[this.activeTab] || ''; }
  getStatusLabel(s: string) { return { SCHEDULED: 'Planifiée', ONGOING: 'En direct', COMPLETED: 'Terminée', CANCELLED: 'Annulée' }[s] || s; }
  getStatusColor(s: string) { return { SCHEDULED: '#2b3ea8', ONGOING: '#ef4444', COMPLETED: '#10b981', CANCELLED: '#94a3b8' }[s] || '#2b3ea8'; }

  joinRoom(id: number) { this.router.navigate(['/virtual-class', id, 'room']); }

  toggleInlinePlay(vc: VirtualClass) {
    if (!vc.hasRecording) return;

    if (this.playingVcId === vc.id) {
      // Même vidéo : toggle play/pause
      if (this.currentVideoEl) {
        if (this.videoIsPaused) {
          this.currentVideoEl.play();
        } else {
          this.currentVideoEl.pause();
        }
      }
      return;
    }

    // Nouvelle vidéo : arrêter la précédente et charger
    this.stopCurrentVideo();
    this.inlineError = '';
    this.playingVcId = vc.id;
    this.loadingVcId = vc.id;
    this.videoIsPaused = true;

    // Enregistrement en fichier : lecture en streaming (démarre tout de suite, version légère si la connexion est faible)
    const url = pickVideoUrl(vc.recordingUrl, vc.recordingLightUrl);
    if (url && !url.startsWith('/api/')) {
      this.playingObjectUrl = url;
      return;
    }
    // Ancien enregistrement encore stocké en base : téléchargement avec le jeton de connexion
    this.http.get(`/api/virtual-classes/${vc.id}/recording`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        this.playingObjectUrl = URL.createObjectURL(blob);
      },
      error: () => {
        this.loadingVcId = null;
        this.playingVcId = null;
        this.inlineError = 'Impossible de charger la vidéo.';
      }
    });
  }

  onVideoError() {
    this.stopCurrentVideo();
    this.inlineError = 'Impossible de lire la vidéo. Vérifiez votre connexion puis réessayez.';
  }

  onVideoReady(event: Event) {
    // « canplay » revient après chaque avance rapide : on ne relance la lecture qu'à l'ouverture
    if (this.currentVideoEl === event.target) return;
    this.loadingVcId = null;
    this.currentVideoEl = event.target as HTMLVideoElement;
    this.currentVideoEl.play();
    this.videoIsPaused = false;
  }

  private stopCurrentVideo() {
    if (this.currentVideoEl) {
      this.currentVideoEl.pause();
      this.currentVideoEl = null;
    }
    if (this.playingObjectUrl) {
      if (this.playingObjectUrl.startsWith('blob:')) URL.revokeObjectURL(this.playingObjectUrl);
      this.playingObjectUrl = null;
    }
    this.playingVcId = null;
    this.loadingVcId = null;
    this.videoIsPaused = true;
  }

  confirmDeleteRecording(vc: VirtualClass) { this.deletingRecording = vc; }

  deleteRecording() {
    if (!this.deletingRecording) return;
    this.deleteLoading = true;
    const vc = this.deletingRecording;
    this.http.delete<VirtualClass>(`/api/teacher/virtual-classes/${vc.id}/recording`).subscribe({
      next: (updated) => {
        const idx = this.classes.findIndex(c => c.id === vc.id);
        if (idx !== -1) this.classes[idx] = { ...this.classes[idx], ...updated };
        this.deleteLoading = false;
        this.deletingRecording = null;
      },
      error: () => {
        this.deleteLoading = false;
        this.deletingRecording = null;
      }
    });
  }

  startSession(vc: VirtualClass) {
    this.http.put<VirtualClass>(`/api/teacher/virtual-classes/${vc.id}/status`, {}, { params: { status: 'ONGOING' } }).subscribe({
      next: () => { vc.status = 'ONGOING'; this.joinRoom(vc.id); },
      error: () => { this.joinRoom(vc.id); }
    });
  }

  createClass() {
    if (!this.newStudents.length && !this.newLevels.size) {
      this.createError = 'Choisissez au moins un niveau ou un étudiant.';
      return;
    }
    const formData = new FormData();
    const data = { ...this.newClass, targetLevels: [...this.newLevels].join(',') };
    formData.append('class', new Blob([JSON.stringify(data)], { type: 'application/json' }));
    if (this.newStudents.length) formData.append('studentList', studentsCsv(this.newStudents));
    this.http.post<VirtualClass>('/api/teacher/virtual-classes', formData).subscribe({
      next: (vc) => {
        this.classes.unshift(vc);
        this.showCreateModal = false;
        this.newClass = { title: '', description: '', scheduledAt: '', durationMinutes: 60 };
        this.newStudents = [];
        this.newLevels = new Set();
        this.createError = '';
      },
      error: (e) => { this.createError = e.error?.message || 'Impossible de créer la session. Vérifiez les informations et la liste des étudiants.'; }
    });
  }
}
