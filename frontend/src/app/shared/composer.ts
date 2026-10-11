import { Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService, errorMessage } from '../core/auth.service';
import { PostsService } from '../core/posts.service';
import { UiService, validateImage } from '../core/ui.service';
import { Avatar } from './avatar';
import { Autosize } from './directives';
import { Icon } from './icon';
import { Modal } from './modal';

const MAX_LENGTH = 500;

/** Diálogo para crear un envío: imagen a la izquierda, texto a la derecha. */
@Component({
  selector: 'ms-composer',
  imports: [FormsModule, Modal, Avatar, Icon, Autosize],
  template: `
    <ms-modal [open]="ui.composerOpen()" label="Nuevo envío" (closed)="close()" style="--modal-w: 880px">
      <form class="glass grid overflow-hidden bg-elevated md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" (ngSubmit)="publish()">
        <!-- Imagen -->
        <div
          class="relative grid aspect-[16/10] place-items-center overflow-hidden bg-ink/40 md:aspect-auto md:min-h-[440px]"
          [class.ring-2]="dragging()"
          [class.ring-primary]="dragging()"
          (dragover)="$event.preventDefault(); dragging.set(true)"
          (dragleave)="dragging.set(false)"
          (drop)="onDrop($event)"
        >
          @if (preview()) {
            <img [src]="preview()" alt="Vista previa" class="absolute inset-0 size-full object-cover opacity-40 blur-2xl" aria-hidden="true" />
            <img [src]="preview()" alt="Vista previa de la imagen" class="relative max-h-full max-w-full object-contain" />
            <button type="button" class="icon-btn absolute top-2 right-2 text-white/90 hover:text-white" aria-label="Quitar imagen" (click)="clearImage()">
              <ms-icon name="close" />
            </button>
          } @else {
            <button type="button" class="grid cursor-pointer justify-items-center gap-3 p-8 text-center text-muted transition hover:text-fg" (click)="fileInput.click()">
              <span class="grid size-16 place-items-center rounded-full bg-primary/15 text-accent">
                <ms-icon name="image" class="size-7" />
              </span>
              <span class="font-display font-semibold">Agregar imagen</span>
              <span class="text-xs text-faint">Opcional · arrastrala o tocá para elegir · JPG, PNG, WEBP o GIF · máx. 8 MB</span>
            </button>
          }
          <input #fileInput type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden" (change)="onFile($event)" />
        </div>

        <!-- Texto -->
        <div class="flex min-h-72 flex-col gap-3 p-5 md:border-l md:border-line">
          <div class="flex items-center gap-3">
            <ms-avatar [user]="auth.user()" [size]="38" />
            <div class="leading-tight">
              <div class="font-semibold">{{ auth.user()?.displayName }}</div>
              <div class="text-sm text-faint">Nuevo envío</div>
            </div>
          </div>
          <label class="sr-only" for="post-title">Título</label>
          <input
            id="post-title"
            name="title"
            class="bg-transparent font-display text-xl font-semibold outline-none placeholder:text-faint"
            placeholder="Título"
            maxlength="100"
            autocomplete="off"
            [ngModel]="title()"
            (ngModelChange)="title.set($event)"
          />
          <label class="sr-only" for="post-content">Mensaje</label>
          <textarea
            #textarea
            msAutosize
            [msAutosizeMax]="360"
            id="post-content"
            name="content"
            class="scrollbar-thin min-h-40 flex-1 resize-none bg-transparent text-lg outline-none placeholder:text-faint"
            placeholder="Escribí tu mensaje. Usá #hashtags para entrar en tendencias."
            [maxlength]="maxLength"
            [ngModel]="content()"
            (ngModelChange)="content.set($event)"
          ></textarea>
          @if (error()) {
            <p class="text-sm text-danger" role="alert">{{ error() }}</p>
          }
          <div class="flex items-center gap-2 border-t border-line pt-3">
            <button type="button" class="icon-btn" aria-label="Agregar imagen" title="Agregar imagen" (click)="fileInput.click()">
              <ms-icon name="image" />
            </button>
            <span class="ml-auto text-xs tabular-nums" [class]="remaining() < 40 ? 'text-danger' : 'text-faint'">{{ remaining() }}</span>
            <button class="btn btn-primary min-h-10 px-6 text-sm" type="submit" [disabled]="!canPublish()">
              {{ sending() ? 'Enviando…' : 'Enviar' }}
            </button>
          </div>
        </div>
      </form>
    </ms-modal>
  `,
})
export class Composer {
  protected readonly ui = inject(UiService);
  protected readonly auth = inject(AuthService);
  private readonly api = inject(PostsService);

  protected readonly maxLength = MAX_LENGTH;
  protected readonly title = signal('');
  protected readonly content = signal('');
  protected readonly image = signal<File | null>(null);
  protected readonly preview = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly sending = signal(false);
  protected readonly dragging = signal(false);
  protected readonly remaining = computed(() => MAX_LENGTH - this.content().length);
  /** Título y mensaje son obligatorios; la imagen es opcional. */
  protected readonly canPublish = computed(() => !this.sending() && !!this.title().trim() && !!this.content().trim());

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  constructor() {
    inject(DestroyRef).onDestroy(() => this.setImage(null));
  }

  protected onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.pick(file);
  }

  protected onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.pick(file);
  }

  protected clearImage() {
    this.setImage(null);
  }

  protected publish() {
    if (!this.canPublish()) return;
    this.sending.set(true);
    this.error.set(null);
    this.api.create(this.title().trim(), this.content().trim(), this.image()).subscribe({
      next: (post) => {
        this.ui.postCreated.next(post);
        this.ui.toast('¡Envío publicado!');
        this.sending.set(false);
        this.reset();
        this.ui.composerOpen.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.sending.set(false);
      },
    });
  }

  protected close() {
    this.ui.composerOpen.set(false);
  }

  private pick(file: File) {
    const problem = validateImage(file, 8);
    this.error.set(problem);
    if (!problem) this.setImage(file);
  }

  private setImage(file: File | null) {
    const previous = this.preview();
    if (previous) URL.revokeObjectURL(previous);
    this.image.set(file);
    this.preview.set(file ? URL.createObjectURL(file) : null);
  }

  private reset() {
    this.title.set('');
    this.content.set('');
    this.setImage(null);
    this.error.set(null);
  }
}
