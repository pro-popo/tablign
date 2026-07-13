import "@testing-library/jest-dom/vitest";
import { fireEvent } from "@testing-library/react";

// Patch fireEvent to properly pass clientX and clientY to pointer events
fireEvent.pointerDown = ((target: Element, init: Partial<PointerEventInit> = {}) => {
  const event = new MouseEvent("pointerdown", {
    bubbles: true,
    cancelable: true,
    ...init,
  }) as any;
  if (init.clientX !== undefined) Object.defineProperty(event, 'clientX', { value: init.clientX, writable: true });
  if (init.clientY !== undefined) Object.defineProperty(event, 'clientY', { value: init.clientY, writable: true });
  if (init.pointerId !== undefined) Object.defineProperty(event, 'pointerId', { value: init.pointerId, writable: true });
  target.dispatchEvent(event);
}) as any;

fireEvent.pointerMove = ((target: Element, init: Partial<PointerEventInit> = {}) => {
  const event = new MouseEvent("pointermove", {
    bubbles: true,
    cancelable: true,
    ...init,
  }) as any;
  if (init.clientX !== undefined) Object.defineProperty(event, 'clientX', { value: init.clientX, writable: true });
  if (init.clientY !== undefined) Object.defineProperty(event, 'clientY', { value: init.clientY, writable: true });
  if (init.pointerId !== undefined) Object.defineProperty(event, 'pointerId', { value: init.pointerId, writable: true });
  target.dispatchEvent(event);
}) as any;
