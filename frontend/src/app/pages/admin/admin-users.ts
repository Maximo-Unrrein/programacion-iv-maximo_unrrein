import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../core/admin.service';
import { AuthService, errorMessage, type User } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { UiService } from '../../core/ui.service';
import { Avatar } from '../../shared/avatar';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { UserForm } from '../../shared/user-form/user-form';

type Filter = 'todos' | 'admins' | 'deshabilitados';

/** Dashboard / usuarios: listado, alta con perfil a elección, habilitar/deshabilitar y cambio de perfil. */
@Component({
  selector: 'ms-admin-users',
  imports: [DatePipe, RouterLink, Avatar, Icon, Modal, UserForm],
  templateUrl: './admin-users.html',
})
export class AdminUsers implements OnInit {
  private readonly api = inject(AdminService);
  private readonly confirm = inject(ConfirmService);
  private readonly ui = inject(UiService);
  protected readonly auth = inject(AuthService);

  protected readonly users = signal<User[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  /** Id del usuario que se está actualizando (para deshabilitar sus botones). */
  protected readonly busy = signal<string | null>(null);

  protected readonly query = signal('');
  protected readonly filter = signal<Filter>('todos');
  protected readonly filters: { id: Filter; label: string }[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'admins', label: 'Administradores' },
    { id: 'deshabilitados', label: 'Deshabilitados' },
  ];

  // Alta de usuario
  protected readonly creating = signal(false);
  protected readonly saving = signal(false);
  protected readonly createError = signal<string | null>(null);
  private readonly form = viewChild(UserForm);

  protected readonly counts = computed(() => {
    const list = this.users();
    return [
      { label: 'Usuarios', value: list.length },
      { label: 'Administradores', value: list.filter((u) => u.role === 'admin').length },
      { label: 'Deshabilitados', value: list.filter((u) => u.active === false).length },
    ];
  });

  protected readonly visibleUsers = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.users().filter((u) => {
      if (this.filter() === 'admins' && u.role !== 'admin') return false;
      if (this.filter() === 'deshabilitados' && u.active !== false) return false;
      return !q || [u.username, u.displayName, u.email].some((v) => v?.toLowerCase().includes(q));
    });
  });

  ngOnInit() {
    this.load();
  }

  protected load() {
    this.loading.set(true);
    this.api.users().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  protected isMe(user: User) {
    return user.id === this.auth.user()?.id;
  }

  protected openCreate() {
    this.createError.set(null);
    this.creating.set(true);
  }

  protected create(data: FormData) {
    this.saving.set(true);
    this.createError.set(null);
    this.api.createUser(data).subscribe({
      next: (user) => {
        this.users.update((list) => [user, ...list]);
        this.saving.set(false);
        this.creating.set(false);
        this.form()?.reset();
        this.ui.toast(`Se creó @${user.username} como ${user.role === 'admin' ? 'administrador' : 'usuario'}`);
      },
      error: (e) => {
        this.saving.set(false);
        this.createError.set(errorMessage(e));
      },
    });
  }

  protected async toggleActive(user: User) {
    const disabling = user.active !== false;
    const accepted = await this.confirm.ask({
      title: disabling ? `¿Deshabilitar a @${user.username}?` : `¿Habilitar a @${user.username}?`,
      message: disabling
        ? 'No va a poder ingresar a MaxSend: al intentarlo se le avisará que no está autorizado.'
        : 'Va a poder volver a ingresar y usar la aplicación.',
      confirmText: disabling ? 'Deshabilitar' : 'Habilitar',
      danger: disabling,
    });
    if (!accepted) return;
    this.update(user, disabling ? this.api.disable(user.id) : this.api.enable(user.id), disabling ? 'deshabilitado' : 'habilitado');
  }

  protected async toggleRole(user: User) {
    const role = user.role === 'admin' ? 'user' : 'admin';
    const accepted = await this.confirm.ask({
      title: role === 'admin' ? `¿Hacer administrador a @${user.username}?` : `¿Quitarle el perfil de administrador a @${user.username}?`,
      message: role === 'admin' ? 'Va a poder gestionar usuarios, ver estadísticas y dar de baja cualquier publicación.' : 'Va a pasar a tener perfil de usuario.',
      confirmText: role === 'admin' ? 'Hacer administrador' : 'Quitar perfil',
    });
    if (!accepted) return;
    this.update(user, this.api.setRole(user.id, role), role === 'admin' ? 'ahora es administrador' : 'ahora es usuario');
  }

  private update(user: User, request: ReturnType<AdminService['enable']>, done: string) {
    this.busy.set(user.id);
    request.subscribe({
      next: (updated) => {
        this.users.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));
        this.busy.set(null);
        this.ui.toast(`@${updated.username} ${done}`);
      },
      error: (e) => {
        this.busy.set(null);
        this.ui.toast(errorMessage(e), 'error');
      },
    });
  }
}
