
export type EventName = 
  | 'arranger_marquee_selection' 
  | 'arranger_clip_split' 
  | 'arranger_snap_engaged' 
  | 'clip_action'
  | 'project_loaded'
  | 'project_created'
  | 'recording_started'
  | 'transport_play'
  | 'transport_stop'
  | 'mixer_action'
  | 'library_import'
  | 'export_started'
  | 'export_completed'
  | 'app_crash'
  | 'permission_denied'
  | 'quota_exceeded'
  | 'onboarding_completed';

class Analytics {
  track(event: EventName, properties?: Record<string, any>) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[Analytics] ${event}`, properties);
    }
    // Integration point for real analytics (Mixpanel, GA4, PostHog)
    // Example: window.mixpanel?.track(event, properties);
  }
}

export const analytics = new Analytics();
