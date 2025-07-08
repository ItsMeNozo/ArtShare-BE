/**
 * Utility functions for notification management and self-notification prevention
 */

export class NotificationUtils {
  /**
   * Checks if a notification should be sent by preventing self-notifications
   * @param fromUserId - The user ID who triggered the action
   * @param toUserId - The user ID who would receive the notification
   * @returns true if notification should be sent, false if it should be prevented
   */
  static shouldSendNotification(fromUserId: string, toUserId: string): boolean {
    // Prevent self-notifications
    if (!fromUserId || !toUserId) {
      return false;
    }

    return fromUserId !== toUserId;
  }

  /**
   * Filters out users who should not receive notifications (e.g., the action performer)
   * @param users - Array of user objects with id property
   * @param excludeUserId - User ID to exclude from notifications
   * @returns Filtered array of users who should receive notifications
   */
  static filterNotificationRecipients<T extends { id: string }>(
    users: T[],
    excludeUserId: string,
  ): T[] {
    return users.filter((user) => user.id !== excludeUserId);
  }

  /**
   * Validates notification payload to ensure required fields are present
   * @param payload - Notification payload object
   * @returns true if payload is valid for notification sending
   */
  static isValidNotificationPayload(payload: {
    from?: string;
    to?: string;
  }): boolean {
    return !!(
      payload.from &&
      payload.to &&
      this.shouldSendNotification(payload.from, payload.to)
    );
  }
}
