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

/** Diálogo para crear un envío: texto (título + mensaje) y, opcionalmente, una imagen. */
@Component({
  selector: 'ms-composer',
  imports: [FormsModule, Modal, Avatar, Icon, Autosize],
  template: `
    <!-- Sólo texto: una columna angosta. Con imagen: imagen a la izquierda y texto a la derecha -->
    <ms-modal [open]="ui.composerOpen()" label="Nuevo envío" (closed)="close()" [style.--modal-w]="preview() ? '880px' : '600px'">
      <form
        class="glass grid overflow-hidden bg-elevated transition-[box-shadow] duration-300"
        [class]="preview() ? 'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : ''"
        [class.ring-2]="dragging()"
        [class.ring-primary]="dragging()"
        (ngSubmit)="publish()"
        (dragover)="$event.preventDefault(); dragging.set(true)"
        (dragleave)="dragging.set(false)"
        (drop)="onDrop($event)"
      >
        @if (preview()) {
          <!-- Imagen adjunta (opcional) -->
          <div class="relative grid aspect-[16/10] animate-fade-in place-items-center overflow-hidden bg-ink/40 md:aspect-auto md:min-h-[440px]">
            <img [src]="preview()" alt="" class="absolute inset-0 size-full object-cover opacity-40 blur-2xl" aria-hidden="true" />
            <img [src]="preview()" alt="Vista previa de la imagen" class="relative max-h-full max-w-full object-contain" />
            <button type="button" class="icon-btn absolute top-2 left-2 text-white/90 hover:text-white" aria-label="Quitar imagen" title="Quitar imagen" (click)="clearImage()">
              <ms-icon name="close" />
            </button>
          </div>
        }

        <!-- Texto -->
        <div class="flex min-h-72 flex-col gap-3 p-5" [class.md:border-l]="!!preview()" [class.md:border-line]="!!preview()">
          <div class="flex items-center gap-3 pr-8">
            <ms-avatar [user]="auth.user()" [size]="38" />
            <div class="leading-tight">
              <div class="font-semibold">{{ auth.user()?.displayName }}</div>
              <div class="text-sm text-faint">{{ preview() ? 'Envío con imagen' : 'Envío de texto' }}</div>
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
            placeholder="¿Qué querés contar? Usá #hashtags para entrar en tendencias."
            [maxlength]="maxLength"
            [ngModel]="content()"
            (ngModelChange)="content.set($event)"
          ></textarea>
          @if (error()) {
            <p class="text-sm text-danger" role="alert">{{ error() }}</p>
          }
          <div class="flex items-center gap-2 border-t border-line pt-3">
            <!-- La imagen es opcional: se adjunta desde acá o arrastrándola sobre el diálogo -->
            <button
              type="button"
              class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-medium text-muted transition hover:text-fg"
              [title]="preview() ? 'Cambiar imagen' : 'Agregar imagen (opcional)'"
              (click)="fileInput.click()"
            >
              <ms-icon name="image" />
              <span class="hidden sm:inline">{{ preview() ? 'Cambiar imagen' : 'Imagen (opcional)' }}</span>
            </button>
            <input #fileInput type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden" (change)="onFile($event)" />
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
