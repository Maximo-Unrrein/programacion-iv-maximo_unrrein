import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService, errorMessage } from '../core/auth.service';
import { PostsService } from '../core/posts.service';
import { UiService, validateImage } from '../core/ui.service';
import { Avatar } from './avatar';
import { Autosize } from './directives';
import { Icon } from './icon';
import { Modal } from './modal';

const MAX_LENGTH = 500;
/** Igual que en el backend (MAX_POST_IMAGES). */
const MAX_IMAGES = 4;

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
          <!-- Imágenes adjuntas (opcionales, hasta 4): la elegida en grande y abajo las miniaturas -->
          <div class="relative grid aspect-[16/10] animate-fade-in place-items-center overflow-hidden bg-ink/40 md:aspect-auto md:min-h-[440px]">
            <img [src]="preview()" alt="" class="absolute inset-0 size-full object-cover opacity-40 blur-2xl" aria-hidden="true" />
            <img [src]="preview()" alt="Vista previa de la imagen" class="relative max-h-full max-w-full object-contain" />
            <button type="button" class="icon-btn absolute top-2 left-2 text-white/90 hover:text-white" aria-label="Quitar esta imagen" title="Quitar esta imagen" (click)="removeImage(selected())">
              <ms-icon name="close" />
            </button>
            <div class="absolute inset-x-0 bottom-0 flex justify-center gap-2 bg-linear-to-t from-ink/70 to-transparent p-3 pt-8">
              @for (url of previews(); track url; let i = $index) {
                <button
                  type="button"
                  class="size-12 cursor-pointer overflow-hidden rounded-xl ring-2 transition duration-300 active:scale-95"
                  [class]="i === selected() ? 'ring-white' : 'opacity-70 ring-transparent hover:opacity-100'"
                  [attr.aria-label]="'Ver imagen ' + (i + 1)"
                  [attr.aria-current]="i === selected()"
                  (click)="selected.set(i)"
                >
                  <img [src]="url" alt="" class="size-full object-cover" />
                </button>
              }
              @if (previews().length < maxImages) {
                <button
                  type="button"
                  class="grid size-12 cursor-pointer place-items-center rounded-xl border border-dashed border-white/50 text-white/80 transition hover:border-white hover:text-white active:scale-95"
                  aria-label="Agregar otra imagen"
                  title="Agregar otra imagen"
                  (click)="fileInput.click()"
                >
                  <ms-icon name="plus" class="size-5" />
                </button>
              }
            </div>
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
            <!-- Las imágenes son opcionales: se adjuntan desde acá o arrastrándolas sobre el diálogo -->
            <button
              type="button"
              class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-medium text-muted transition hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
              [title]="preview() ? 'Agregar otra imagen' : 'Agregar imágenes (opcional, hasta 4)'"
              [disabled]="images().length >= maxImages"
              (click)="fileInput.click()"
            >
              <ms-icon name="image" />
              <span class="hidden sm:inline">{{ preview() ? images().length + '/' + maxImages + ' imágenes' : 'Imágenes (opcional)' }}</span>
            </button>
            <input #fileInput type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden" multiple (change)="onFile($event)" />
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
  protected readonly maxImages = MAX_IMAGES;
  protected readonly title = signal('');
  protected readonly content = signal('');
  /** Imágenes elegidas (en orden del carrusel) y sus vistas previas locales. */
  protected readonly images = signal<File[]>([]);
  protected readonly previews = signal<string[]>([]);
  /** Imagen que se ve en grande. */
  protected readonly selected = signal(0);
  protected readonly preview = computed(() => this.previews()[this.selected()] ?? null);
  protected readonly error = signal<string | null>(null);
  protected readonly sending = signal(false);
  protected readonly dragging = signal(false);
  protected readonly remaining = computed(() => MAX_LENGTH - this.content().length);
  /** Título y mensaje son obligatorios; las imágenes son opcionales. */
  protected readonly canPublish = computed(() => !this.sending() && !!this.title().trim() && !!this.content().trim());

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearImages());
  }

  protected onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    this.add(files);
  }

  protected onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(false);
    this.add([...(event.dataTransfer?.files ?? [])]);
  }

  protected removeImage(index: number) {
    URL.revokeObjectURL(this.previews()[index]);
    this.images.update((list) => list.filter((_, i) => i !== index));
    this.previews.update((list) => list.filter((_, i) => i !== index));
    this.selected.set(Math.max(0, Math.min(this.selected(), this.previews().length - 1)));
  }

  protected publish() {
    if (!this.canPublish()) return;
    this.sending.set(true);
    this.error.set(null);
    this.api.create(this.title().trim(), this.content().trim(), this.images()).subscribe({
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

  /** Agrega las imágenes válidas hasta completar el máximo; la última agregada queda a la vista. */
  private add(files: File[]) {
    if (!files.length) return;
    const room = MAX_IMAGES - this.images().length;
    const problems = files.map((f) => validateImage(f, 8)).filter(Boolean);
    const valid = files.filter((f) => !validateImage(f, 8)).slice(0, Math.max(0, room));
    this.error.set(
      problems[0] ?? (files.length - problems.length > room ? `Podés adjuntar hasta ${MAX_IMAGES} imágenes.` : null),
    );
    if (!valid.length) return;
    this.images.update((list) => [...list, ...valid]);
    this.previews.update((list) => [...list, ...valid.map((f) => URL.createObjectURL(f))]);
    this.selected.set(this.previews().length - 1);
  }

  private clearImages() {
    this.previews().forEach((url) => URL.revokeObjectURL(url));
    this.images.set([]);
    this.previews.set([]);
    this.selected.set(0);
  }

  private reset() {
    this.title.set('');
    this.content.set('');
    this.clearImages();
    this.error.set(null);
  }
}
