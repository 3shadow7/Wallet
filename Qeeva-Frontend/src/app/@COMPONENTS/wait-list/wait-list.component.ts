import { Component, inject, signal, ChangeDetectionStrategy, HostListener, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { WaitlistService } from '@SERVICES/waitlist.service';

@Component({
  selector: 'app-wait-list',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './wait-list.component.html',
  // 1) your existing sign-up styles (fix this path to where register.component.scss really is)
  // 2) the few extra styles this page needs
  styleUrls: ['../auth/register/register.component.scss', './wait-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WaitListComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private waitlist = inject(WaitlistService);

  isLoading = signal(false);
  isDone = signal(false);
  errorMessage = signal<string | null>(null);

  // 3D mouse tracking (same as sign-up). Only runs in the browser.
  mouseX = signal(0);
  mouseY = signal(0);

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    this.mouseX.set((event.clientX / window.innerWidth - 0.5) * 60);
    this.mouseY.set((event.clientY / window.innerHeight - 0.5) * 60);
  }

  // Where the visitor came from, e.g. /wait-list?source=twitter
  private source: string | null = null;

  ngOnInit(): void {
    const s = this.route.snapshot.queryParamMap.get('source');
    this.source = s ? s.slice(0, 40) : null;
  }

  form = this.fb.group({
    username: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9_]{3,20}$/)]],
    email: ['', [Validators.required, Validators.email]],
    website: [''] // honeypot: real people never fill this
  });

  isFieldInvalid(name: string): boolean {
    const field = this.form.get(name);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    // Bot filled the hidden field: pretend it worked, store nothing.
    if (this.form.value.website) {
      this.isDone.set(true);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const result = await this.waitlist.join({
      username: this.form.value.username!,
      email: this.form.value.email!,
      source: this.source
    });

    this.isLoading.set(false);

    if (result.ok) {
      this.isDone.set(true);
      return;
    }
    switch (result.reason) {
      case 'email_taken':
        this.errorMessage.set('This email is already on the whitelist.');
        break;
      case 'username_taken':
        this.errorMessage.set('That username is taken. Try another one.');
        break;
      default:
        this.errorMessage.set('Something went wrong. Check your connection and try again.');
    }
  }
}
