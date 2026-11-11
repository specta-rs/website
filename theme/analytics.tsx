"use client";

import { useEffect } from "react";

let initialized = false;

/**
 * PostHog used to be initialised by Waku's client entry. Rspress has no
 * equivalent entry, so run the same setup once from the theme. The import is
 * dynamic so the browser-only package never runs during static rendering.
 */
export function Analytics() {
  useEffect(() => {
    if (initialized || process.env.NODE_ENV === "development") return;
    // Previewing a production build on localhost should not pollute analytics,
    // and the `/ph_*` proxy only exists on the deployed Worker.
    if (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    ) {
      return;
    }
    initialized = true;

    void import("posthog-js").then(({ default: posthog }) => {
      posthog.init("phc_eQP8pRBKw0mQWdUYXWE2HBcqQ5n9qP9h5R4xF5Y39aG", {
        api_host: "/ph_ebbd7f",
        ui_host: "https://us.posthog.com",
        defaults: "2025-05-24",
        person_profiles: "identified_only",
        capture_exceptions: true,
      });
    });
  }, []);

  return null;
}
