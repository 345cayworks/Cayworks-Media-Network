"use client";

/**
 * Delete button that wraps a bound Server Action in a form and asks the
 * user to confirm before submitting. Used on entity detail pages so admins
 * can remove records inline without leaving the page.
 */
export function DeleteButton({
  action,
  label = "Delete",
  confirmText,
}: {
  action: () => void;
  label?: string;
  confirmText: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        // eslint-disable-next-line no-alert
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <button type="submit" className="btn-danger">
        {label}
      </button>
    </form>
  );
}
