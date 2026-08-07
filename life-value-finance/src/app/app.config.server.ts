import { provideServerRendering, withRoutes } from '@angular/ssr';
import { mergeApplicationConfig, ApplicationConfig, inject, REQUEST } from '@angular/core';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { INITIAL_DEVICE_TYPE } from '@core/viewPort/initial-device-type.token';
import { detectDeviceTypeFromUA } from '@core/viewPort/device-detection.util';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    {
      provide: INITIAL_DEVICE_TYPE,
      useFactory: () => {
        const req = inject(REQUEST, { optional: true });
        const ua = req?.headers.get('user-agent') ?? null;
        return detectDeviceTypeFromUA(ua);
      },
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
