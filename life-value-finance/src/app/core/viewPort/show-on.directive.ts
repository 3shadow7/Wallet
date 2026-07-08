// show-on.directive.ts
import { Directive, Input, TemplateRef, ViewContainerRef, inject, effect } from '@angular/core';
import { ViewportService, DeviceType } from './viewport.service';

@Directive({
  selector: '[appShowOn]',
  standalone: true,
})
export class ShowOnDirective {
  private templateRef = inject(TemplateRef<unknown>);
  private viewContainer = inject(ViewContainerRef);
  private viewport = inject(ViewportService);

  private hasView = false;

  @Input() set appShowOn(devices: DeviceType[]) {
    this.devices = devices;
  }
  private devices: DeviceType[] = [];

  constructor() {
    effect(() => {
      const shouldShow = this.devices.includes(this.viewport.deviceType());

      if (shouldShow && !this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!shouldShow && this.hasView) {
        this.viewContainer.clear();
        this.hasView = false;
      }
    });
  }
}
