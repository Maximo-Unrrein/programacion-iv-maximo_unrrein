import { Component, computed, input } from '@angular/core';
import { MediaPipe } from './pipes';

interface AvatarUser {
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

/** Foto de perfil o, si no hay, la inicial sobre el degradado de la marca. */
@Component({
  selector: 'ms-avatar',
  imports: [MediaPipe],
  template: `
    @if (user()?.avatarUrl) {
      <img [src]="user()!.avatarUrl | media" alt="" class="size-full rounded-full object-cover" />
    } @else {
      <span
        class="grid size-full place-items-center rounded-full bg-brand font-display font-bold text-on-brand"
        [style.font-size.px]="size() * 0.42"
        >{{ initial() }}</span
      >
    }
  `,
  host: {
    class: 'inline-block shrink-0 rounded-full',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    role: 'img',
    '[attr.aria-label]': "'Foto de ' + (user()?.displayName || user()?.username || 'usuario')",
  },
})
export class Avatar {
  readonly user = input<AvatarUser | null | undefined>();
  readonly size = input(40);
  protected readonly initial = computed(() =>
    (this.user()?.displayName || this.user()?.username || '?').charAt(0).toUpperCase(),
  );
}
