import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Texto con los #hashtags convertidos en enlaces a Tendencias (sin innerHTML). */
@Component({
  selector: 'ms-rich-text',
  imports: [RouterLink],
  template: `@for (part of parts(); track $index) {@if (part.tag) {<a
        class="font-medium text-accent hover:underline"
        routerLink="/tendencias"
        [queryParams]="{ tag: part.tag }"
        (click)="$event.stopPropagation()"
        >{{ part.text }}</a
      >} @else {{{ part.text }}}}`,
  host: { class: 'whitespace-pre-wrap wrap-anywhere' },
})
export class RichText {
  readonly text = input('');
  protected readonly parts = computed(() =>
    this.text()
      .split(/(#[\p{L}\p{N}_]{2,30})/u)
      .filter(Boolean)
      .map((text) => ({ text, tag: text.startsWith('#') ? text.slice(1).toLowerCase() : null })),
  );
}
