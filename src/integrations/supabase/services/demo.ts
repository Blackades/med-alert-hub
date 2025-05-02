
// Re-export all functionality from the new modular files for backward compatibility
export * from './notification-service';
export * from './esp32-service';
export * from './notification-history';

// For backward compatibility with existing code
// Export DemoNotificationType as an alias of NotificationType
import { NotificationType } from './notification-service';
export type DemoNotificationType = NotificationType;
