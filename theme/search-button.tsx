import { useI18n } from "@rspress/core/runtime";
import { IconSearch, SvgWrapper } from "@rspress/core/theme-original";
import { useSyncExternalStore } from "react";

export interface SearchButtonProps {
  setFocused: (focused: boolean) => void;
}

const subscribe = () => () => {};
const getMetaKey = () =>
  /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform) ? "⌘" : "Ctrl";
const getServerMetaKey = () => "";

/**
 * The desktop button is already a real `<button>`, but Rspress renders the
 * mobile icon as a `<div>`. That makes the only search entry point on phones
 * unreachable by keyboard. Keep the same markup and styling hooks, but use a
 * button with an accessible name for both.
 */
export function SearchButton({ setFocused }: SearchButtonProps) {
  const t = useI18n();
  const metaKey = useSyncExternalStore(subscribe, getMetaKey, getServerMetaKey);

  return (
    <>
      <button
        type="button"
        className="rp-search-button"
        onClick={() => setFocused(true)}
      >
        <div className="rp-search-button__content">
          <SvgWrapper icon={IconSearch} className="rp-search-button__icon" />
          <span className="rp-search-button__word">
            {t("searchPlaceholderText")}
          </span>
        </div>
        <div
          className="rp-search-button__hotkey"
          style={{ opacity: metaKey ? 1 : 0 }}
        >
          <span>{metaKey}</span>
          <span>K</span>
        </div>
      </button>
      <button
        type="button"
        className="rp-search-button--mobile"
        aria-label={t("searchPlaceholderText")}
        onClick={() => setFocused(true)}
      >
        <SvgWrapper icon={IconSearch} />
      </button>
    </>
  );
}
