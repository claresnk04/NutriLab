import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTitle = DialogPrimitive.Title;
const DialogOverlay = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-20 bg-[#04201d]/40', className)}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-30 w-[calc(100%-32px)] max-w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-4 shadow-2xl',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="close-button absolute right-3 top-3" aria-label="Tutup">
        <X size={22} />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export { Dialog, DialogContent, DialogTitle };
