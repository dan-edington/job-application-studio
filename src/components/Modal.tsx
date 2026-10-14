import { useEffect, useRef, type ReactNode } from 'react';

export function Modal({
  children,
  onClose,
  labelledBy = 'help-title',
}: {
  children: ReactNode;
  onClose: () => void;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      opener?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal-dialog"
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
