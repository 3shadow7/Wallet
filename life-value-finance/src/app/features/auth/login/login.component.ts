import { Component, inject, signal, ChangeDetectionStrategy, HostListener } from '@angular/core';
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
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  
  isLoading = signal(false);

  // 3D Mouse Tracking Logic
  mouseX = signal(0);
  mouseY = signal(0);

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    const x = (event.clientX / window.innerWidth - 0.5) * 60;
    const y = (event.clientY / window.innerHeight - 0.5) * 60;
    this.mouseX.set(x);
    this.mouseY.set(y);
  }
  
  loginForm = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(4)]]
  });

  errorMessage = signal<string | null>(null);

  isFieldInvalid(name: string): boolean {
    const field = this.loginForm.get(name);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  onContinueAsGuest() {
    this.authService.continueAsGuest();
    this.router.navigate(['/dashboard']);
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
