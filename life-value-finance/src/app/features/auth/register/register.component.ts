import { Component, inject, signal, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  
  isLoading = signal(false);

  // 3D Mouse Tracking Logic
  mouseX = signal(0);
  mouseY = signal(0);

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    // Normalize coordinates for rotation
    const x = (event.clientX / window.innerWidth - 0.5) * 60;
    const y = (event.clientY / window.innerHeight - 0.5) * 60;
    this.mouseX.set(x);
    this.mouseY.set(y);
  }
  
  registerForm = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  errorMessage = signal<string | null>(null);

  isFieldInvalid(name: string): boolean {
    const field = this.registerForm.get(name);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  onContinueAsGuest() {
    this.authService.continueAsGuest();
    this.router.navigate(['/dashboard']);
  }

  onSubmit() {
    if (this.registerForm.valid) {
      this.isLoading.set(true);
      this.errorMessage.set(null);
      
      this.authService.register(this.registerForm.value).subscribe({
        next: () => {
          // Auto login after registration
          this.authService.login({
            username: this.registerForm.value.username,
            password: this.registerForm.value.password
          }).subscribe({
            next: () => {
              this.isLoading.set(false);
              this.router.navigate(['/dashboard']);
            },
            error: (err) => {
              this.isLoading.set(false);
              this.router.navigate(['/login']); // Fallback
            }
          });
        },
        error: (err) => {
          this.isLoading.set(false);
          const detail = err.error?.detail;
          if (typeof detail === 'object') {
            // Handle field-specific errors if necessary
            this.errorMessage.set(Object.values(detail).join(' '));
          } else {
            this.errorMessage.set(detail || 'Registration failed. Please try again.');
          }
        }
      });
    } else {
      this.registerForm.markAllAsTouched();
    }
  }
}
