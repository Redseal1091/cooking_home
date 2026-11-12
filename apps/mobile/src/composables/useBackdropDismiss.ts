/**
 * Защита от случайного закрытия модалки при появлении системной клавиатуры Android,
 * скролле или изменении высоты viewport.
 * Закрывает модалку только если pointerdown И pointerup произошли непосредственно на backdrop
 * и курсор/палец при этом находился в верхних 20% экрана (выше карточки модального окна).
 */
export function useBackdropDismiss(onClose: () => void) {
  let isBackdropPointerDown = false;
  let activePointerId: number | null = null;

  function isInTopDismissZone(clientY: number): boolean {
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight || 0;
    if (viewportHeight <= 0) return false;
    return clientY >= 0 && clientY <= viewportHeight * 0.2;
  }

  function onBackdropPointerDown(event: PointerEvent) {
    if (
      event.target === event.currentTarget &&
      isInTopDismissZone(event.clientY)
    ) {
      isBackdropPointerDown = true;
      activePointerId = event.pointerId;
    } else {
      isBackdropPointerDown = false;
      activePointerId = null;
    }
  }

  function onBackdropPointerUp(event: PointerEvent) {
    const shouldClose =
      isBackdropPointerDown &&
      activePointerId === event.pointerId &&
      event.target === event.currentTarget &&
      isInTopDismissZone(event.clientY);

    isBackdropPointerDown = false;
    activePointerId = null;

    if (shouldClose) {
      onClose();
    }
  }

  function onBackdropPointerCancel() {
    isBackdropPointerDown = false;
    activePointerId = null;
  }

  return {
    onBackdropPointerDown,
    onBackdropPointerUp,
    onBackdropPointerCancel,
  };
}
