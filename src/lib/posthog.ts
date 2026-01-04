"use client";

import posthog from "posthog-js";

if (!import.meta.env.SSR)
  posthog.init("phc_eQP8pRBKw0mQWdUYXWE2HBcqQ5n9qP9h5R4xF5Y39aG", {
    api_host: "/ph_ebbd7f",
    ui_host: "https://us.posthog.com",
    defaults: "2025-05-24",
    person_profiles: "identified_only",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
  });
