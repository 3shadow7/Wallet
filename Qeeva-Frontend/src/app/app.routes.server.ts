import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
    //? this will be for landing page, but we don't have one yet , also keep renderMode: RenderMode.Prerender
    //? this means this route will not have gard using cookies , and becouse we use SSR we will not have access to localStorage,
    //? so we will use cookies to store the auth token AND guest token
    //  { path: '', renderMode: RenderMode.Prerender },
    //  { path: 'about', renderMode: RenderMode.Prerender },
    //  { path: 'terms', renderMode: RenderMode.Prerender },
     { path: '**', renderMode: RenderMode.Server },
];
