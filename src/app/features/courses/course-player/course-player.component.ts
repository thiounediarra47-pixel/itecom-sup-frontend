import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CourseService } from '../../../core/services/course.service';
import { ProgressService } from '../../../core/services/progress.service';
import { Course, Lesson } from '../../../core/models/course.model';
import { OfflineService, formatSize } from '../../../core/services/offline.service';
import { DialogService } from '../../../core/services/dialog.service';
import { AuthService } from '../../../core/services/auth.service';
import { VideoQuality, getVideoQuality, pickVideoUrl, setVideoQuality } from '../../../core/utils/video-quality';
import { MAX_COUNTED_RATE, WatchTracker } from '../../../core/utils/watch-tracker';

type CoursePlayerTab = 'cours' | 'pratique';

@Component({
  selector: 'app-course-player',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, DecimalPipe],
  templateUrl: './course-player.component.html',
  styleUrl: './course-player.component.scss'
})
export class CoursePlayerComponent implements OnInit, OnDestroy {

  // ─── État ────────────────────────────────────────────────────────────────

  course: Course | null = null;
  currentLesson: Lesson | null = null;
  courseId!: number;
  activeTab: CoursePlayerTab = 'cours';
  sidebarOpen = false;

  overallProgress = 0;
  completedCount = 0;
  markingComplete = false;

  selectedQuiz: number | null = null;
  readonly quizOptions = ['int x = 5;', 'var x = 5', 'x = 5;', 'declare x = 5;'];

  private lastSentScrollPercentage = 0;
  private scrollUpdatePending = false;

  // Temps passé : compté seconde par seconde tant que l'onglet est visible, envoyé par paquets
  private static readonly TIME_FLUSH_SECONDS = 30;
  private pendingSeconds = 0;
  private timeTicker: ReturnType<typeof setInterval> | null = null;

  constructor(
    private route: ActivatedRoute,
    private courseService: CourseService,
    private progressService: ProgressService,
    private sanitizer: DomSanitizer,
    public offline: OfflineService,
    private dialogs: DialogService,
    private authService: AuthService,
    private router: Router
  ) {}

  // ─── Vidéo et hors connexion ─────────────────────────────────────────────

  quality: VideoQuality = getVideoQuality();

  get isDownloaded(): boolean { return this.offline.isDownloaded(this.courseId); }

  get downloadProgress(): number | null {
    return this.offline.downloading$.value[this.courseId] ?? null;
  }

  /** Vidéo stockée sur l'appareil pour cette leçon (cours téléchargé). */
  get playingDownloaded(): boolean {
    return !!this.currentLesson && !!this.offline.downloadedVideo(this.courseId, this.currentLesson.id);
  }

  /** Cours téléchargé : version stockée ; sinon qualité choisie (légère si connexion faible). */
  get videoSrc(): string | null {
    if (!this.currentLesson) return null;
    return this.offline.downloadedVideo(this.courseId, this.currentLesson.id)
      ?? pickVideoUrl(this.currentLesson.videoUrl, this.currentLesson.videoLightUrl);
  }

  setQuality(q: VideoQuality) {
    this.quality = q;
    setVideoQuality(q);
  }

  async downloadForOffline() {
    if (!this.course) return;
    try {
      const saved = await this.offline.download(this.course);
      this.dialogs.toast(`« ${saved.title} » est disponible hors connexion (${formatSize(saved.sizeBytes)}).`, 'success', 6000);
    } catch (e: any) {
      this.dialogs.toast(e?.message || 'Téléchargement impossible. Réessayez avec une meilleure connexion.', 'danger', 7000);
    }
  }

  async removeOffline() {
    const ok = await this.dialogs.confirm({ title: 'Retirer ce cours de l\'appareil ?',
      message: 'Il ne sera plus disponible sans connexion. Vous pourrez le télécharger à nouveau.', icon: 'bi-trash3',
      tone: 'danger', confirmText: 'Retirer' });
    if (ok) {
      await this.offline.remove(this.courseId);
      this.dialogs.toast('Cours retiré de l\'appareil.', 'info');
    }
  }

  ngOnInit(): void {
    this.courseId = +this.route.snapshot.paramMap.get('id')!;
    this.courseService.getCourseById(this.courseId).subscribe(course => {
      // Un professeur ne consulte que ses propres cours
      if (this.authService.isTeacher && course.teacher?.id !== this.authService.currentUser?.id) {
        this.router.navigate(['/teacher/courses']);
        return;
      }
      this.course = course;
      if (course.lessons?.length) {
        this.selectLesson(course.lessons[0]);
      }
      this.refreshProgress();
    });
    this.timeTicker = setInterval(() => this.tickTime(), 1000);
  }

  ngOnDestroy(): void {
    if (this.timeTicker) clearInterval(this.timeTicker);
    this.flushTime();
    this.flushVideo();
  }

  private tickTime(): void {
    if (!this.currentLesson || document.hidden) return;
    this.pendingSeconds++;
    this.secondsOnLesson++;
    if (this.secondsOnLesson === CoursePlayerComponent.MIN_READING_SECONDS) this.measureReading();
    if (this.pendingSeconds >= CoursePlayerComponent.TIME_FLUSH_SECONDS) this.flushTime();
  }

  private flushTime(): void {
    if (!this.currentLesson || this.pendingSeconds <= 0) return;
    const seconds = this.pendingSeconds;
    this.pendingSeconds = 0;
    this.progressService.addTimeSpent(this.currentLesson.id, seconds).subscribe({ error: () => {} });
  }

  // ─── Getters dérivés ───────────────────────────────────────────────────────

  get exerciseLessons(): Lesson[] {
    return (this.course?.lessons ?? []).filter(
      l => l.type === 'EXCEL_EXERCISE' || l.type === 'CODE_EXERCISE' || l.exercise
    );
  }

  exerciseColor(ex: Lesson): string {
    if (ex.type === 'EXCEL_EXERCISE') return '#0ea5e9';
    if (ex.type === 'CODE_EXERCISE') return '#2b3ea8';
    return '#f59e0b';
  }

  exerciseLabel(ex: Lesson): string {
    if (ex.type === 'EXCEL_EXERCISE') return 'Tableur Excel';
    if (ex.type === 'CODE_EXERCISE') return 'Exercice code';
    if (ex.type === 'PDF') return 'Fiche PDF';
    if (ex.type === 'VIDEO') return 'Vidéo';
    return 'Quiz';
  }

  /** Pour les exercices PDF/Vidéo/Quiz : bascule vers l'onglet Cours sur cette leçon. */
  openExerciseInCourse(ex: Lesson): void {
    this.activeTab = 'cours';
    this.selectLesson(ex);
  }

  get isFirstLesson(): boolean {
    if (!this.course?.lessons || !this.currentLesson) return true;
    return this.course.lessons[0].id === this.currentLesson.id;
  }

  get isLastLesson(): boolean {
    if (!this.course?.lessons || !this.currentLesson) return true;
    return this.course.lessons[this.course.lessons.length - 1].id === this.currentLesson.id;
  }

  // ─── Navigation entre leçons ────────────────────────────────────────────

  selectLesson(lesson: Lesson): void {
    if (this.currentLesson && this.currentLesson.id !== lesson.id) {
      this.flushTime();
      this.flushVideo();
    }
    this.currentLesson = lesson;
    this.selectedQuiz = null;
    this.lastSentScrollPercentage = lesson.completed ? 100 : (lesson.progressPercentage ?? 0);
    this.secondsOnLesson = 0;
    this.watch = new WatchTracker();
    this.videoDuration = 0;
    this.resumed = false;
    // Contenu court, déjà entièrement visible : la lecture est mesurée sans défilement
    setTimeout(() => this.measureReading(), 600);
  }

  prevLesson(): void {
    const idx = this.currentLessonIndex();
    if (idx > 0) this.selectLesson(this.course!.lessons![idx - 1]);
  }

  nextLesson(): void {
    const idx = this.currentLessonIndex();
    if (idx >= 0 && idx < this.course!.lessons!.length - 1) {
      this.selectLesson(this.course!.lessons![idx + 1]);
    }
  }

  private currentLessonIndex(): number {
    if (!this.course?.lessons || !this.currentLesson) return -1;
    return this.course.lessons.findIndex(l => l.id === this.currentLesson!.id);
  }

  // ─── Progression ────────────────────────────────────────────────────────

  markComplete(): void {
    if (!this.currentLesson) return;
    this.markingComplete = true;
    this.progressService.completeLesson(this.currentLesson.id).subscribe({
      next: () => {
        this.currentLesson!.completed = true;
        this.currentLesson!.progressPercentage = 100;
        this.markingComplete = false;
        this.refreshProgress();
      },
      error: err => {
        this.markingComplete = false;
        this.dialogs.toast(err?.error?.message || 'Impossible de terminer la leçon.', 'warning', 6000);
      }
    });
  }

  // ─── Règles d'achèvement selon le type de leçon ─────────────────────────

  /** Secondes passées sur la leçon ouverte (onglet visible). */
  secondsOnLesson = 0;
  /** Lecture d'un document : temps minimal avant « J'ai terminé ». */
  static readonly MIN_DOCUMENT_SECONDS = 30;
  /** Lecture d'un texte : temps minimal avant l'achèvement automatique en bas de page. */
  static readonly MIN_READING_SECONDS = 15;

  /** Vidéo de la plateforme : terminée en la regardant (90 %), pas par un bouton. */
  get isTrackedVideo(): boolean {
    const l = this.currentLesson;
    return !!l && l.type === 'VIDEO' && !!l.videoUrl && l.videoUrl.startsWith('/uploads/');
  }

  get isDocument(): boolean { return this.currentLesson?.type === 'PDF' && !!this.currentLesson.pdfUrl; }

  /** Secondes restantes avant de pouvoir terminer un document. */
  get documentWait(): number {
    return this.isDocument ? Math.max(0, CoursePlayerComponent.MIN_DOCUMENT_SECONDS - this.secondsOnLesson) : 0;
  }

  get lessonPercent(): number {
    const l = this.currentLesson;
    if (!l) return 0;
    if (l.completed) return 100;
    return Math.round(Math.max(l.progressPercentage ?? 0, this.isTrackedVideo ? this.watch.sessionPercent(this.videoDuration) : 0));
  }

  // ─── Vidéo : plages réellement regardées, reprise de la lecture ─────────

  private watch = new WatchTracker();
  private videoDuration = 0;
  private resumed = false;
  private lastVideoFlush = 0;
  private videoPosition = 0;
  readonly maxCountedRate = MAX_COUNTED_RATE;

  onVideoMetadata(video: HTMLVideoElement) {
    this.videoDuration = video.duration || 0;
    const pos = this.currentLesson?.videoPosition ?? 0;
    // Reprise là où l'étudiant s'était arrêté (sauf tout au début ou à la toute fin)
    if (!this.resumed && pos > 5 && pos < this.videoDuration - 5) {
      video.currentTime = pos;
      this.dialogs.toast(`Reprise de la vidéo à ${this.formatTime(pos)}`, 'info', 3000);
    }
    this.resumed = true;
  }

  onVideoTime(video: HTMLVideoElement) {
    if (!this.isTrackedVideo) return;
    this.videoDuration = video.duration || this.videoDuration;
    this.videoPosition = video.currentTime;
    this.watch.onTime(video.currentTime, video.playbackRate, video.paused || video.seeking);
    if (Date.now() - this.lastVideoFlush > 15_000) this.flushVideo();
  }

  onVideoBreak(video: HTMLVideoElement, flush = false) {
    this.watch.breakContinuity();
    this.videoPosition = video.currentTime;
    if (flush) this.flushVideo();
  }

  /** Envoie les plages vues (toutes les 15 s, à la pause, à la fin, en changeant de leçon ou de page). */
  private flushVideo(keepalive = false) {
    const lesson = this.currentLesson;
    if (!lesson || !this.isTrackedVideo || !(this.videoDuration > 0)) return;
    if (!this.watch.hasPending() && Math.abs(this.videoPosition - (lesson.videoPosition ?? 0)) < 3) return;
    this.lastVideoFlush = Date.now();
    const body = { duration: this.videoDuration, position: this.videoPosition, ranges: this.watch.take() };
    lesson.videoPosition = this.videoPosition;
    if (keepalive) {
      // Page en train de se fermer : envoi garanti par le navigateur
      const token = localStorage.getItem('token');
      fetch(`/api/progress/lesson/${lesson.id}/video`, { method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body) }).catch(() => {});
      return;
    }
    this.progressService.saveVideoProgress(lesson.id, body).subscribe({
      next: res => {
        const d = res?.data;
        if (!d) return;   // gardé hors connexion : envoyé plus tard
        lesson.progressPercentage = d.percentage;
        if (d.completed && !lesson.completed) {
          lesson.completed = true;
          this.dialogs.toast('Vidéo terminée : leçon validée.', 'success');
          this.refreshProgress();
        } else {
          this.refreshProgress();
        }
      },
      error: () => {}
    });
  }

  formatTime(seconds: number): string {
    const s = Math.floor(seconds);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  @HostListener('document:visibilitychange')
  onVisibility() {
    if (document.hidden) { this.flushTime(); this.flushVideo(true); }
  }

  @HostListener('window:pagehide')
  onPageHide() { this.flushVideo(true); }

  refreshProgress(): void {
    this.progressService.getCourseProgress(this.courseId).subscribe(p => {
      this.overallProgress = p.overallPercentage;
      this.completedCount = p.completedLessons;
    });
  }

  /**
   * Suit la lecture de la page : une fois le bas de la leçon atteint, la leçon est
   * automatiquement marquée comme complétée (sans action manuelle de l'élève).
   */
  onContentScroll(_el?: HTMLElement): void {
    this.measureReading();
  }

  /** Sur téléphone, c'est la page entière qui défile (et non la zone de contenu). */
  @HostListener('window:scroll')
  onWindowScroll() { this.measureReading(); }

  /**
   * Part de la leçon lue : défilement de la zone de contenu (ordinateur) ou de la page (téléphone).
   * Une leçon texte est terminée en bas de page, après un temps minimal de lecture.
   * Les vidéos (mesurées en les regardant) et les documents (bouton « J'ai terminé ») ne passent pas par là.
   */
  measureReading(): void {
    if (!this.currentLesson || this.currentLesson.completed || this.scrollUpdatePending || this.isTrackedVideo || this.isDocument) return;
    const el = document.querySelector<HTMLElement>('.content-area');
    if (!el) return;
    let percentage: number;
    if (el.scrollHeight > el.clientHeight + 2) {
      const scrollable = el.scrollHeight - el.clientHeight;
      percentage = Math.min(100, (el.scrollTop / scrollable) * 100);
    } else {
      const rect = el.getBoundingClientRect();
      const visibleBottom = window.innerHeight - 70;   // au-dessus de la barre d'onglets du téléphone
      percentage = rect.height <= 0 ? 100 : Math.max(0, Math.min(100, ((visibleBottom - rect.top) / rect.height) * 100));
    }
    // Fin atteinte trop vite (simple survol) : on attend le temps minimal de lecture
    if (percentage >= 95 && this.secondsOnLesson < CoursePlayerComponent.MIN_READING_SECONDS) percentage = 94;

    // On n'envoie une mise à jour que par tranche de 10% pour ne pas spammer le serveur.
    if (percentage - this.lastSentScrollPercentage < 10 && percentage < 95) return;

    this.lastSentScrollPercentage = percentage;
    this.scrollUpdatePending = true;
    const lessonId = this.currentLesson.id;

    this.progressService.updateScrollProgress(lessonId, percentage).subscribe({
      next: () => {
        this.scrollUpdatePending = false;
        if (this.currentLesson?.id === lessonId) {
          this.currentLesson.progressPercentage = Math.max(this.currentLesson.progressPercentage ?? 0, percentage >= 95 ? 100 : percentage);
          if (percentage >= 95) this.currentLesson.completed = true;
          this.refreshProgress();
        }
      },
      error: () => { this.scrollUpdatePending = false; }
    });
  }

  // ─── Documents (PDF / Word) ─────────────────────────────────────────────

  /** Seuls les vrais PDF s'affichent dans un iframe ; les fichiers Word doivent être téléchargés. */
  isViewableInline(url: string): boolean {
    return /\.pdf$/i.test(url);
  }

  /**
   * Adresse sûre du document, gardée tant que le document ne change pas : une nouvelle valeur à chaque
   * rafraîchissement de l'écran rechargerait l'iframe (retour à la 1re page du PDF, clignotements).
   */
  safeDocUrl(url: string): SafeResourceUrl {
    if (url !== this.safeDoc?.url) this.safeDoc = { url, safe: this.sanitizer.bypassSecurityTrustResourceUrl(url) };
    return this.safeDoc.safe;
  }
  private safeDoc: { url: string; safe: SafeResourceUrl } | null = null;
}
