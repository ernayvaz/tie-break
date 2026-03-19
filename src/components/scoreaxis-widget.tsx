"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type Props = {
  src: string;
  title: string;
  description?: string | null;
  minHeight?: number;
  compact?: boolean;
  fallbackMessage?: string;
  widgetId?: string;
  preserveQueryWidgetId?: boolean;
};

export function ScoreAxisWidget({
  src,
  title,
  description,
  minHeight = 360,
  compact = false,
  fallbackMessage = "This official widget is coming soon while we finish the provider connection.",
  widgetId: providedWidgetId,
  preserveQueryWidgetId = false,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const reactId = useId();
  const [loadState, setLoadState] = useState<"loading" | "ready" | "failed">(
    "loading"
  );
  const widgetKey = useMemo(
    () => providedWidgetId ?? reactId.replace(/[^a-zA-Z0-9_-]/g, ""),
    [providedWidgetId, reactId]
  );
  const widgetId = useMemo(() => widgetKey, [widgetKey]);
  const resolvedSrc = useMemo(() => {
    if (preserveQueryWidgetId) return src;

    try {
      const url = new URL(src);
      url.searchParams.set("widgetId", widgetKey);
      return url.toString();
    } catch {
      return src;
    }
  }, [preserveQueryWidgetId, src, widgetKey]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    setLoadState("loading");
    host.innerHTML = "";

    const widget = document.createElement("div");
    widget.id = widgetId;
    widget.className = "scoreaxis-widget";
    widget.style.width = "auto";
    widget.style.height = "auto";
    widget.style.overflow = "auto";
    widget.style.fontSize = compact ? "12px" : "14px";
    widget.style.backgroundColor = "#ffffff";
    widget.style.color = "#141416";
    widget.style.border = "1px solid";
    widget.style.borderColor = "#ecf1f7";

    const attribution = document.createElement("div");
    attribution.className = "widget-main-link";
    attribution.style.padding = "6px 12px";
    attribution.style.fontWeight = "500";
    attribution.innerHTML =
      'Live data by <a href="https://www.scoreaxis.com/" target="_blank" rel="noreferrer" style="color: inherit;">Scoreaxis</a>';

    const script = document.createElement("script");
    script.src = resolvedSrc;
    script.async = true;

    let loadCheckTimeout = 0;
    let failSafeTimeout = 0;
    let disposed = false;

    const clearTimers = () => {
      window.clearTimeout(loadCheckTimeout);
      window.clearTimeout(failSafeTimeout);
    };

    const hasWidgetContent = () =>
      Array.from(widget.childNodes).some((node) => {
        if (node === script) return false;
        if (
          node.nodeType === Node.ELEMENT_NODE &&
          (node as HTMLElement).classList.contains("widget-main-link")
        ) {
          return false;
        }
        if (node.nodeType === Node.TEXT_NODE) {
          return Boolean(node.textContent?.trim());
        }

        return node.nodeType === Node.ELEMENT_NODE;
      });

    const markReady = () => {
      if (disposed) return;
      clearTimers();
      setLoadState("ready");
      observer.disconnect();
    };

    const markFailed = () => {
      if (disposed) return;
      if (hasWidgetContent()) {
        markReady();
        return;
      }

      setLoadState("failed");
    };

    const observer = new MutationObserver(() => {
      if (hasWidgetContent()) {
        markReady();
      }
    });

    observer.observe(widget, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    script.onload = () => {
      loadCheckTimeout = window.setTimeout(() => {
        markFailed();
      }, 8000);
    };

    script.onerror = () => {
      markFailed();
    };

    failSafeTimeout = window.setTimeout(() => {
      markFailed();
    }, 25000);

    host.appendChild(widget);
    widget.appendChild(script);
    widget.appendChild(attribution);

    return () => {
      disposed = true;
      clearTimers();
      observer.disconnect();
      host.innerHTML = "";
    };
  }, [compact, resolvedSrc, widgetId]);

  return (
    <section className="rounded-[1.5rem] border border-nord-polarLighter/12 bg-white/88 p-4 shadow-[0_18px_50px_rgba(46,52,64,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-nord-polar">{title}</h4>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-nord-polarLight">{description}</p>
          ) : null}
        </div>
        <span className="rounded-full border border-nord-frostDark/15 bg-nord-frostDark/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-nord-frostDark">
          {loadState === "failed" ? "Coming soon" : "Official"}
        </span>
      </div>
      <div
        ref={hostRef}
        className={`mt-4 overflow-hidden rounded-[1.2rem] border border-nord-polarLighter/10 bg-white shadow-inner ${
          loadState === "failed" ? "hidden" : ""
        }`}
        style={{ minHeight }}
      />
      {loadState === "failed" ? (
        <div className="mt-4 rounded-[1.2rem] border border-dashed border-nord-polarLighter/18 bg-nord-snow/55 px-4 py-4 text-sm leading-6 text-nord-polarLight">
          {fallbackMessage}
        </div>
      ) : null}
    </section>
  );
}
