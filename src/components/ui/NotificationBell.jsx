import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCircle2, Clock, AlertCircle, FileText, FlaskConical, TestTube, X, CheckCheck } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { formatTime } from "../../lib/format";
import "./NotificationBell.css";

function getNotificationLink(notification, role) {
  if (notification.type === "prescription_approved" && notification.prescriptionId) {
    return `/patient/prescriptions/${notification.prescriptionId}`;
  }

  if (notification.type === "lab_report_ready") {
    return "/patient/lab-reports";
  }

  if (notification.type === "tests_ordered") {
    return "/patient/tests";
  }

  if (notification.type === "precheck_sent" || notification.type === "precheck_questions_ready") {
    if (role === "doctor" && notification.appointmentId) {
      return `/doctor/patient/${notification.appointmentId}`;
    }
    return notification.appointmentId
      ? `/patient/appointments/${notification.appointmentId}?bucket=action`
      : "/patient/appointments?bucket=action";
  }

  if (notification.type === "precheck_completed") {
    if (role === "doctor" && notification.appointmentId) {
      return `/doctor/patient/${notification.appointmentId}`;
    }
    return notification.appointmentId
      ? `/patient/appointments/${notification.appointmentId}?bucket=review`
      : "/patient/appointments?bucket=review";
  }

  if (notification.type === "appointment_missed") {
    return notification.appointmentId
      ? `/patient/appointments/${notification.appointmentId}?bucket=missed`
      : "/patient/appointments?bucket=missed";
  }

  if (notification.type === "appointment_reminder") {
    if (role === "doctor" && notification.appointmentId) {
      return `/doctor/patient/${notification.appointmentId}`;
    }

    if (role === "admin") {
      return "/admin/appointments";
    }

    return notification.appointmentId
      ? `/patient/appointments/${notification.appointmentId}?bucket=upcoming`
      : "/patient/appointments?bucket=upcoming";
  }

  if (notification.type === "appointment_booked" && notification.appointmentId) {
    return `/patient/appointments/${notification.appointmentId}`;
  }

  return null;
}

export function NotificationBell({ notifications, onMarkAsRead, role }) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications]);
  const hasUnread = unreadCount > 0;

  const handleMarkAsRead = (notification) => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id);
    }
  };

  const handleNotificationClick = (notification) => {
    handleMarkAsRead(notification);
    const link = getNotificationLink(notification, role);
    if (link) {
      setIsOpen(false);
      navigate(link);
    }
  };

  const handleMarkAllAsRead = () => {
    notifications.forEach((notification) => {
      if (!notification.is_read) {
        onMarkAsRead(notification.id);
      }
    });
  };

  return (
    <div className="relative notification-bell-wrap">
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`notification-bell-trigger relative rounded-xl p-2.5 text-text-secondary transition ${
          isOpen ? "is-open" : ""
        } ${hasUnread ? "has-unread" : ""}`}
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Bell size={20} className="relative z-[1]" />
        {hasUnread && (
          <span className="notification-bell-count absolute -right-1 -top-1 z-[2] flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="notification-bell-panel absolute right-0 z-50 mt-2 max-h-96 w-[22rem] overflow-y-auto rounded-2xl border border-line bg-white shadow-2xl sm:w-96">
          <div className="sticky top-0 flex items-center justify-between gap-2 border-b bg-white p-4">
            <div>
              <h3 className="font-semibold text-text-primary">Notifications</h3>
              <p className="mt-0.5 text-xs text-text-tertiary">
                {hasUnread ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {hasUnread ? (
                <button
                  onClick={handleMarkAllAsRead}
                  className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs font-medium text-text-secondary transition hover:bg-surface-2 hover:text-text-primary"
                  title="Mark all as read"
                >
                  <CheckCheck size={14} />
                  Mark all
                </button>
              ) : null}
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-text-tertiary transition hover:bg-surface-2 hover:text-text-primary"
                aria-label="Close notifications"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">
              <Bell size={32} className="mx-auto mb-2 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                  hasLink={Boolean(getNotificationLink(notification, role))}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden
        />
      )}
    </div>
  );
}

/**
 * Individual Notification Item
 */
function NotificationItem({ notification, onClick, hasLink }) {
  const getIcon = (type) => {
    switch (type) {
      case "appointment_booked":
        return <CheckCircle2 size={16} className="text-green-600" />;
      case "precheck_questions_ready":
        return <FileText size={16} className="text-cyan-600" />;
      case "precheck_sent":
        return <FileText size={16} className="text-blue-600" />;
      case "precheck_completed":
        return <CheckCircle2 size={16} className="text-green-600" />;
      case "appointment_reminder":
        return <Clock size={16} className="text-orange-600" />;
      case "appointment_missed":
        return <AlertCircle size={16} className="text-rose-600" />;
      case "prescription_approved":
        return <CheckCircle2 size={16} className="text-green-600" />;
      case "tests_ordered":
        return <TestTube size={16} className="text-cyan-600" />;
      case "lab_report_ready":
        return <FlaskConical size={16} className="text-violet-600" />;
      default:
        return <AlertCircle size={16} className="text-text-secondary" />;
    }
  };

  return (
    <div
      className={`cursor-pointer p-4 transition hover:bg-surface-2 ${
        !notification.is_read ? "bg-blue-50" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0 pt-1">{getIcon(notification.type)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-text-primary text-sm">
              {notification.title}
            </p>
            {!notification.is_read && (
              <div className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 mt-1" />
            )}
          </div>
          {notification.message && (
            <p className="text-sm text-text-secondary mt-1 line-clamp-2">
              {notification.message}
            </p>
          )}
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-text-tertiary">
              {formatTime(notification.created_at)}
            </p>
            {hasLink && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-sky">
                Open &rarr;
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline Notification Alerts (for important items like pre-check)
 */
export function PrecheckNotification({ notification, onDismiss, onAction }) {
  return (
    <Card className="border-2 border-blue-200 bg-blue-50">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <FileText size={24} className="text-blue-600" />
            <div className="flex-1">
              <h3 className="font-semibold text-text-primary">
                {notification.title}
              </h3>
              <p className="text-sm text-text-secondary mt-1">
                {notification.message}
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-text-tertiary hover:text-text-primary p-2"
          >
            <X size={18} />
          </button>
        </div>
        {onAction && (
          <div className="mt-3 pt-3 border-t border-blue-200">
            <button
              onClick={onAction}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition text-sm"
            >
              View Questions
            </button>
          </div>
        )}
      </CardHeader>
    </Card>
  );
}
