import { Component, inject, signal, ChangeDetectionStrategy, HostListener, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

   URLSTATE_isActionFromUser = (window?.history && window?.history?.state?.URLSTATE_isActionFromUser) ?? null; // an optional input uses (url state input) to determine if the action is initiated by the user (e.g., clicking a "Login" button)

  ngOnInit(): void {
    if (this.URLSTATE_isActionFromUser) {
      // ignore the redirect logic if the action is initiated by the user (e.g., clicking a "Login" button)
    }else {
      // If the user is already authenticated or a guest, redirect them to the dashboard
      if (this.authService.isAuthenticated() || this.authService.isGuest()) {
        this.router.navigate(['/dashboard']);
      }
    }
  }

  @ViewChild('floatingWallet') floatingWallet: any;
  isLoading = signal(false);

  // 3D Mouse Tracking Logic
  mouseX = signal(0);
  mouseY = signal(0);

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.floatingWallet) return;
    const rect = this.floatingWallet.nativeElement.getBoundingClientRect();
    const x = (event.clientX / window.innerWidth - (rect.left + rect.width / 2) / window.innerWidth) * 60;
    const y = (event.clientY / window.innerHeight - (rect.top + rect.height / 2) / window.innerHeight) * 60;
    this.mouseX.set(x);
    this.mouseY.set(y);
  }

  loginForm = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(4)]]
  });

  errorMessage = signal<string | null>(null);

  onContinueAsGuest() {
    this.authService.continueAsGuest();
    this.router.navigate(['/dashboard']);
  }

  onRegisterClick() {
    // Navigate to the register page
    this.router.navigate(['/register'], {
      state: {
        URLSTATE_isActionFromUser: true // 👈 Sent ONLY on button click
      }
    });
  }

  onSubmit() {
    if (this.loginForm.valid) {
      this.isLoading.set(true);
      this.errorMessage.set(null);

      this.authService.login(this.loginForm.value).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.isLoading.set(false);
          console.error('Login failed', err);
          this.errorMessage.set(err.error?.detail || 'Invalid username or password');
        }
      });
    } else {
      this.loginForm.markAllAsTouched();
    }
  }
}
