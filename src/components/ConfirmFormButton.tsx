"use client";

/**
 * Submit button that asks the user to confirm before letting the form
 * submit. Used for destructive bulk actions inside a parent form: pair the
 * button's `formAction` with a server action and pass a clear confirm
 * message. Plain Approve/Reject submits stay on the parent action.
 */
export function ConfirmFormButton({
  action,
  confirmText,
  className,
  children,
}: {
  action: (formData: FormData) => void;
  confirmText: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      formAction={action}
      className={className}
      onClick={(e) => {
        // eslint-disable-next-line no-alert
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
