import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService, errorMessage } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { Post, Profile as ProfileModel } from '../../core/models';
import { PostsService } from '../../core/posts.service';
import { ProfileService } from '../../core/profile.service';
import { UiService, validateImage } from '../../core/ui.service';
import { birthDate, errorText, NAME_PATTERN } from '../../core/validators';
import { Avatar } from '../../shared/avatar';
import { AgePipe } from '../../shared/pipes';
import { Icon } from '../../shared/icon';
import { PostCard } from '../../shared/post-card/post-card';

/** Se muestran las últimas 3 publicaciones (con sus comentarios) y se pueden cargar de a 3 más. */
const PAGE = 3;
const BIO_MAX = 280;

@Component({
  selector: 'ms-profile',
  imports: [DatePipe, AgePipe, ReactiveFormsModule, RouterLink, Avatar, Icon, PostCard],
  templateUrl: './profile.html',
})
export class Profile {
  private readonly profiles = inject(ProfileService);
  private readonly postsApi = inject(PostsService);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  protected readonly ui = inject(UiService);

  /** Parámetro de ruta /u/:username */
  readonly username = input.required<string>();

  protected readonly profile = signal<ProfileModel | null>(null);
  protected readonly notFound = signal(false);
  protected readonly posts = signal<Post[]>([]);
  protected readonly loadingPosts = signal(false);
  protected readonly done = signal(false);

  protected readonly isMe = computed(() => this.profile()?.id === this.auth.user()?.id);

  // ---------- edición ----------
  protected readonly bioMax = BIO_MAX;
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly form = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(40), Validators.pattern(NAME_PATTERN)] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(40), Validators.pattern(NAME_PATTERN)] }),
    birthDate: new FormControl('', { nonNullable: true, validators: [Validators.required, birthDate] }),
    bio: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(BIO_MAX)] }),
  });
  protected readonly maxBirthDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 13);
    return d.toISOString().slice(0, 10);
  })();

  constructor() {
    effect(() => this.load(this.username()));

    // Si publico desde mi perfil, aparece primero
    this.ui.postCreated.pipe(takeUntilDestroyed()).subscribe((post) => {
      if (this.isMe()) {
        this.posts.update((list) => [post, ...list]);
        this.bumpStats(1);
      }
    });
  }

  private load(username: string) {
    this.profile.set(null);
    this.notFound.set(false);
    this.posts.set([]);
    this.done.set(false);
    this.editing.set(false);
    this.profiles.get(username).subscribe({
      next: (p) => {
        this.profile.set(p);
        this.loadMore();
      },
      error: () => this.notFound.set(true),
    });
  }

  protected loadMore() {
    const profile = this.profile();
    if (!profile || this.loadingPosts() || this.done()) return;
    this.loadingPosts.set(true);
    this.postsApi.feed({ author: profile.username, limit: PAGE, before: this.posts().at(-1)?.createdAt }).subscribe({
      next: (page) => {
        this.posts.update((list) => [...list, ...page]);
        this.done.set(page.length < PAGE);
        this.loadingPosts.set(false);
      },
      error: (e) => {
        this.loadingPosts.set(false);
        this.ui.toast(errorMessage(e), 'error');
      },
    });
  }

  protected err(name: keyof typeof this.form.controls, patternMessage?: string) {
    const control = this.form.controls[name];
    return control.touched ? errorText(control, patternMessage) : null;
  }

  protected startEdit() {
    const p = this.profile()!;
    this.form.reset({
      firstName: p.firstName,
      lastName: p.lastName,
      birthDate: p.birthDate ? p.birthDate.slice(0, 10) : '',
      bio: p.bio ?? '',
    });
    this.editing.set(true);
  }

  protected save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    const { firstName, lastName, birthDate, bio } = this.form.getRawValue();
    this.profiles.update({ firstName: firstName.trim(), lastName: lastName.trim(), birthDate, bio: bio.trim() }).subscribe({
      next: (p) => {
        this.applyProfile(p);
        this.editing.set(false);
        this.saving.set(false);
        this.ui.toast('Perfil actualizado');
      },
      error: (e) => {
        this.saving.set(false);
        this.ui.toast(errorMessage(e), 'error');
      },
    });
  }

  protected onAvatarFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const problem = validateImage(file, 3);
    if (problem) {
      this.ui.toast(problem, 'error');
      return;
    }
    this.uploading.set(true);
    this.profiles.uploadAvatar(file).subscribe({
      next: (p) => {
        this.applyProfile(p);
        this.uploading.set(false);
        this.ui.toast('Foto actualizada');
      },
      error: (e) => {
        this.uploading.set(false);
        this.ui.toast(errorMessage(e), 'error');
      },
    });
  }

  protected async removeAvatar() {
    const accepted = await this.confirm.ask({
      title: '¿Quitar tu foto de perfil?',
      message: 'Vas a volver a mostrar tu inicial en lugar de la foto.',
      confirmText: 'Quitar foto',
      danger: true,
    });
    if (!accepted) return;
    this.uploading.set(true);
    this.profiles.removeAvatar().subscribe({
      next: (p) => {
        this.applyProfile(p);
        this.uploading.set(false);
        this.ui.toast('Foto quitada');
      },
      error: (e) => {
        this.uploading.set(false);
        this.ui.toast(errorMessage(e), 'error');
      },
    });
  }

  protected onRemoved(id: string) {
    this.posts.update((list) => list.filter((p) => p.id !== id));
    this.bumpStats(-1);
  }

  /** Refleja los cambios en el perfil, en la sesión y en el autor de las publicaciones ya cargadas. */
  private applyProfile(p: ProfileModel) {
    this.profile.set(p);
    this.auth.patchUser({
      firstName: p.firstName,
      lastName: p.lastName,
      displayName: p.displayName,
      birthDate: p.birthDate,
      avatarUrl: p.avatarUrl,
      bio: p.bio,
    });
    const author = { id: p.id, username: p.username, displayName: p.displayName, avatarUrl: p.avatarUrl };
    this.posts.update((list) => list.map((post) => ({ ...post, author })));
  }

  private bumpStats(delta: number) {
    this.profile.update((p) => (p ? { ...p, stats: { ...p.stats, posts: Math.max(0, p.stats.posts + delta) } } : p));
  }
}
