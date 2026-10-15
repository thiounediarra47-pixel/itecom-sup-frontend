import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { ApiResponse } from '../../core/models/api-response.model';

interface Message {
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
  loading?: boolean;
}

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fade-in-up">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 class="fw-bold mb-1"><i class="bi bi-robot me-1"></i>Assistant IA</h1>
          <p class="text-muted">Posez vos questions sur la programmation, obtenez des explications et des exemples</p>
        </div>
        <button class="btn btn-outline-danger btn-sm" (click)="clearChat()">
          <i class="bi bi-trash me-1"></i>Effacer
        </button>
      </div>

      <div class="row g-4">
        <div class="col-lg-8">
          <div class="ai-chat-container shadow-sm">
            <!-- Messages -->
            <div class="ai-messages" #messagesContainer id="messages-container">
              <!-- Welcome -->
              <div class="text-center py-4" *ngIf="messages.length === 0">
                <div style="font-size:3.5rem"><i class="bi bi-robot"></i></div>
                <h5 class="mt-2 fw-bold">Bonjour {{ authService.currentUser?.firstName }} !</h5>
                <p class="text-muted small">Je suis votre assistant IA spécialisé en programmation.<br>Posez-moi toutes vos questions !</p>
              </div>

              <!-- Messages -->
              <div *ngFor="let msg of messages" class="ai-message" [class.user]="msg.role === 'user'">
                <div class="ai-avatar"
                     [style.background]="msg.role === 'bot' ? '#2b3ea8' : '#e2e8f0'">
                  <i class="bi" [ngClass]="msg.role === 'bot' ? 'bi-robot' : (authService.currentUser?.firstName?.charAt(0) || 'bi-person')"></i>
                </div>
                <div class="ai-bubble" [class.bot]="msg.role === 'bot'" [class.user]="msg.role === 'user'">
                  <div *ngIf="msg.loading" class="d-flex gap-1 align-items-center">
                    <div class="spinner-grow spinner-grow-sm text-secondary" style="width:.5rem;height:.5rem"></div>
                    <div class="spinner-grow spinner-grow-sm text-secondary" style="width:.5rem;height:.5rem;animation-delay:.1s"></div>
                    <div class="spinner-grow spinner-grow-sm text-secondary" style="width:.5rem;height:.5rem;animation-delay:.2s"></div>
                  </div>
                  <div *ngIf="!msg.loading" [innerHTML]="formatMessage(msg.text)"></div>
                  <div class="text-end mt-1" style="font-size:.65rem; opacity:.5">
                    {{ msg.timestamp | date:'HH:mm' }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Input -->
            <div class="ai-input-area">
              <textarea class="form-control border-0 bg-light" rows="2" [(ngModel)]="inputText"
                placeholder="Ex: Explique-moi les interfaces en Java..."
                (keydown.enter)="onEnterKey($any($event))"
                style="resize:none; border-radius:12px; font-size:0.9rem"></textarea>
              <button class="btn btn-primary flex-shrink-0" (click)="sendMessage()"
                      [disabled]="!inputText.trim() || loading"
                      style="border-radius:12px; width:44px; height:44px; padding:0">
                <i *ngIf="!loading" class="bi bi-send-fill"></i>
                <div *ngIf="loading" class="spinner-border spinner-border-sm"></div>
              </button>
            </div>
          </div>
        </div>

        <!-- Suggestions Panel -->
        <div class="col-lg-4">
          <div class="card border-0 shadow-sm mb-3" style="border-radius:16px">
            <div class="card-body p-4">
              <h6 class="fw-bold mb-3"><i class="bi bi-lightbulb me-1"></i>Questions suggérées</h6>
              <div class="d-flex flex-column gap-2">
                <button *ngFor="let s of suggestions" class="btn btn-outline-secondary btn-sm text-start"
                        (click)="askSuggestion(s)" style="border-radius:8px">
                  {{ s }}
                </button>
              </div>
            </div>
          </div>

          <div class="card border-0 shadow-sm" style="border-radius:16px">
            <div class="card-body p-4">
              <h6 class="fw-bold mb-3"><i class="bi bi-journal-bookmark me-1"></i>Sujets disponibles</h6>
              <div class="d-flex flex-wrap gap-2">
                <span *ngFor="let topic of topics" class="badge bg-light text-dark border px-3 py-2"
                      style="border-radius:20px; cursor:pointer; font-size:.8rem"
                      (click)="askAboutTopic(topic)">
                  {{ topic }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AiAssistantComponent {
  messages: Message[] = [];
  inputText = '';
  loading = false;

  suggestions = [
    'Explique-moi les lambdas en Java',
    'Quelle est la différence entre == et equals() ?',
    'Comment fonctionne Angular Change Detection ?',
    'Explique les closures en JavaScript',
    'Qu\'est-ce qu\'un index en SQL ?',
    'Comment créer une API REST avec Spring Boot ?'
  ];

  topics = ['Java', 'Python', 'JavaScript', 'Angular', 'Spring Boot', 'SQL', 'Algorithms', 'POO', 'Recursion', 'Design Patterns'];

  constructor(private http: HttpClient, public authService: AuthService) {}

  onEnterKey(event: KeyboardEvent) {
    if (!event.shiftKey) { event.preventDefault(); this.sendMessage(); }
  }

  askSuggestion(text: string) { this.inputText = text; this.sendMessage(); }
  askAboutTopic(topic: string) { this.inputText = `Explique-moi les bases de ${topic} avec des exemples`; this.sendMessage(); }

  sendMessage() {
    if (!this.inputText.trim() || this.loading) return;
    let userText = this.inputText.trim();
    this.inputText = '';

    this.messages.push({ role: 'user', text: userText, timestamp: new Date() });

    let loadingMsg: Message = { role: 'bot', text: '', timestamp: new Date(), loading: true };
    this.messages.push(loadingMsg);
    this.loading = true;
    this.scrollToBottom();

    let history = this.messages
      .filter(m => !m.loading && m.text)
      .slice(-10)
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));

    this.http.post<ApiResponse<{ reply: string }>>('/api/ai-assistant/chat', { messages: history }).subscribe({
      next: (resp) => {
        let text = resp.data?.reply || 'Désolé, je n\'ai pas pu générer de réponse.';
        let idx = this.messages.indexOf(loadingMsg);
        if (idx !== -1) this.messages[idx] = { role: 'bot', text, timestamp: new Date() };
        this.loading = false;
        this.scrollToBottom();
      },
      error: () => {
        let idx = this.messages.indexOf(loadingMsg);
        if (idx !== -1) this.messages[idx] = {
          role: 'bot',
          text: 'Désolé, je rencontre un problème de connexion. Vérifiez votre connexion et réessayez.',
          timestamp: new Date()
        };
        this.loading = false;
      }
    });
  }

  clearChat() { this.messages = []; }

  formatMessage(text: string): string {
    return text
      .replace(/```(\w+)?\n?([\s\S]*?)```/g, '<pre class="bg-dark text-white p-3 rounded-3 my-2" style="font-size:.8rem;overflow-x:auto"><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code class="bg-light px-1 rounded">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  scrollToBottom() {
    setTimeout(() => {
      let el = document.getElementById('messages-container');
      if (el) el.scrollTop = el.scrollHeight;
    }, 100);
  }
}
