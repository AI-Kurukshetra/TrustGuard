"use client";

import { type TouchEvent, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";
import { SidebarNavigation } from "@/components/sidebar";

type MobileSidebarDrawerProps = {
  pathname: string;
  companyName?: string | null;
};

export function MobileSidebarDrawer({ pathname, companyName }: MobileSidebarDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (!isOpen) {
      return;
    }

    const startX = event.touches[0]?.clientX ?? 0;
    setIsDragging(true);
    setDragOffset(0);
    event.currentTarget.dataset.touchStartX = String(startX);
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (!isDragging || !isOpen) {
      return;
    }

    const startX = Number(event.currentTarget.dataset.touchStartX ?? "0");
    const currentX = event.touches[0]?.clientX ?? startX;
    const delta = currentX - startX;
    if (delta < 0) {
      setDragOffset(delta);
    } else {
      setDragOffset(0);
    }
  }

  function handleTouchEnd() {
    if (!isDragging) {
      return;
    }

    const shouldClose = dragOffset < -72;
    setIsDragging(false);
    setDragOffset(0);
    if (shouldClose) {
      setIsOpen(false);
    }
  }

  return (
    <>
      <div className="sticky top-0 z-20 mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/85 px-3 py-2 backdrop-blur-xl lg:hidden">
        <BrandLogo variant="compact" className="px-1 py-1" markClassName="h-7 w-7 rounded-md" />
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={isOpen}
          className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm font-medium text-slate-100 transition hover:border-white/25 hover:bg-white/[0.08]"
        >
          Menu
        </button>
      </div>

      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden transition-opacity duration-300",
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <button
          type="button"
          aria-label="Close navigation menu"
          className="absolute inset-0 h-full w-full bg-black/65 backdrop-blur-[1px]"
          onClick={() => setIsOpen(false)}
        />
        <div className="relative z-10 h-full w-[86vw] max-w-[320px]">
          <div
            className={cn(
              "h-full transition-transform duration-300 ease-out",
              isOpen ? "translate-x-0" : "-translate-x-full",
              isDragging && "transition-none"
            )}
            style={isOpen && dragOffset < 0 ? { transform: `translateX(${dragOffset}px)` } : undefined}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            <SidebarNavigation
              pathname={pathname}
              companyName={companyName}
              stickyDesktop={false}
              onNavigate={() => setIsOpen(false)}
              className="h-full border-r border-white/10 border-b-0 bg-slate-950/95"
            />
          </div>
        </div>
      </div>
    </>
  );
}
