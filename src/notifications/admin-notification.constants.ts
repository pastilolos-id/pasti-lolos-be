export const ADMIN_NOTIFICATION_LINK_PREFIX = '/admin';
export const ADMIN_PENDING_PAYMENT_TITLE =
  'Pembayaran baru menunggu verifikasi';

/** Union eksplisit (bukan `typeof NOTIFICATION_EVENT[...]`) supaya ESLint/TS tidak gagal resolve. */
export type NotificationEventKey =
  | 'payment_pending_student'
  | 'payment_pending_admin'
  | 'payment_approved_student'
  | 'payment_rejected_student'
  | 'free_exam_activated_student'
  | 'bulk_payment_approved_student'
  | 'exam_submitted_student';

export const NOTIFICATION_EVENT = {
  PAYMENT_PENDING_STUDENT: 'payment_pending_student',
  PAYMENT_PENDING_ADMIN: 'payment_pending_admin',
  PAYMENT_APPROVED_STUDENT: 'payment_approved_student',
  PAYMENT_REJECTED_STUDENT: 'payment_rejected_student',
  FREE_EXAM_ACTIVATED_STUDENT: 'free_exam_activated_student',
  BULK_PAYMENT_APPROVED_STUDENT: 'bulk_payment_approved_student',
  EXAM_SUBMITTED_STUDENT: 'exam_submitted_student',
} as const satisfies Record<string, NotificationEventKey>;
