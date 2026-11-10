"use client";

import { useStorageValue, type TabsProps } from "@rspress/core/theme-original";
import clsx from "clsx";
import {
  Children,
  Fragment,
  forwardRef,
  useId,
  useMemo,
  useState,
  type ForwardedRef,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";

type TabItem = {
  label: ReactNode;
  value: string;
  disabled?: boolean;
};

type ResolvedTabItem = {
  label?: ReactNode;
  value?: string;
  disabled?: boolean;
  content?: ReactNode;
};

type TabChildProps = {
  label?: ReactNode;
  value?: string;
  disabled?: boolean;
};

const groupIdPrefix = "rspress.tabs.";

function resolveTabs(
  children: ReactElement[],
  values: ReadonlyArray<TabItem> | undefined,
): ResolvedTabItem[] {
  if (values && values.length > 0) {
    return values.map((item, index) => ({
      ...item,
      content:
        children.find(
          (child) => (child.props as TabChildProps)?.value === item.value,
        ) ?? children[index],
    }));
  }

  return Children.map<ResolvedTabItem, ReactElement>(
    children,
    (child, index) => {
      const props = child.props as TabChildProps;
      return {
        label: props?.label || undefined,
        value: props?.value,
        disabled: props?.disabled,
        content: children[index],
      };
    },
  );
}

/**
 * Rspress ships tabs as clickable `<div>`s, which leaves the package-manager
 * picker unreachable by keyboard and invisible to assistive technology. This
 * keeps the same storage key, markup classes and SSG behaviour, but renders
 * real `<button role="tab">` controls with arrow-key navigation.
 */
export const Tabs = forwardRef(function Tabs(
  {
    values,
    defaultIndex,
    defaultValue,
    onChange,
    children: rawChildren,
    groupId,
    tabPosition = "left",
    className,
    labelItemClassName,
    contentItemClassName,
    keepDOM = true,
  }: TabsProps,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const children = Children.toArray(rawChildren).filter(
    (child) => !(typeof child === "string" && child.trim() === ""),
  ) as ReactElement[];

  const tabValues = useMemo(
    () => resolveTabs(children, values),
    [children, values],
  );

  const defaultValueIndex =
    defaultValue !== undefined
      ? tabValues.findIndex((item) => item.value === defaultValue)
      : -1;
  const initialActiveIndex =
    defaultValueIndex === -1 ? (defaultIndex ?? 0) : defaultValueIndex;

  const [activeIndex, setActiveIndex] = useState(initialActiveIndex);
  const [storageIndex, setStorageIndex] = useStorageValue<string>(
    `${groupIdPrefix}${groupId}`,
    initialActiveIndex.toString(),
  );

  const baseId = useId();
  const storedIndex = Number(storageIndex);
  const currentIndex =
    groupId &&
    Number.isInteger(storedIndex) &&
    storedIndex >= 0 &&
    storedIndex < tabValues.length
      ? storedIndex
      : activeIndex;

  if (import.meta.env.SSG_MD) {
    return (
      <>
        {tabValues.map(({ label, content }, index) => (
          <Fragment key={index}>
            {`\n**${label}**\n\n`}
            {content}
            {"\n"}
          </Fragment>
        ))}
      </>
    );
  }

  const select = (index: number) => {
    if (tabValues[index]?.disabled) return;
    onChange?.(index);
    if (groupId) {
      setStorageIndex(index.toString());
    } else {
      setActiveIndex(index);
    }
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (index + 1) % tabValues.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (index - 1 + tabValues.length) % tabValues.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = tabValues.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    select(next);
    document.getElementById(`${baseId}-tab-${next}`)?.focus();
  };

  return (
    <div className={clsx("rp-tabs", className)} ref={ref}>
      {tabValues.length ? (
        <div
          className="rp-tabs__label rp-tabs__label--no-scrollbar"
          role="tablist"
          aria-orientation="horizontal"
          style={{
            justifyContent: tabPosition === "center" ? "center" : "flex-start",
          }}
        >
          {tabValues.map(({ label, value, disabled }, index) => {
            const isActive = index === currentIndex;
            return (
              <button
                key={value ?? index}
                type="button"
                id={`${baseId}-tab-${index}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`${baseId}-panel-${index}`}
                tabIndex={isActive ? 0 : -1}
                disabled={disabled}
                className={clsx(
                  "rp-tabs__label__item",
                  isActive
                    ? "rp-tabs__label__item--selected"
                    : "rp-tabs__label__item--not-selected",
                  labelItemClassName,
                )}
                data-index={index}
                onClick={() => select(index)}
                onKeyDown={(event) => handleKeyDown(event, index)}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="rp-tabs__content">
        {tabValues.map(({ value, content }, index) => {
          const isActive = index === currentIndex;
          if (!keepDOM && !isActive) return null;

          return (
            <div
              key={value ?? index}
              id={`${baseId}-panel-${index}`}
              role="tabpanel"
              aria-labelledby={`${baseId}-tab-${index}`}
              hidden={!isActive}
              className={clsx(
                "rp-tabs__content__item",
                isActive
                  ? "rp-tabs__content__item--active"
                  : "rp-tabs__content__item--hidden",
                contentItemClassName,
              )}
              data-index={index}
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
});

Tabs.displayName = "Tabs";
