import { createFileRoute, redirect } from "@tanstack/react-router";

// SEO-friendly alias: /counties/nairobi -> /marketplace/nairobi
export const Route = createFileRoute("/counties/$slug")({
  loader: ({ params }) => {
    throw redirect({
      to: "/marketplace/$county",
      params: { county: params.slug },
      replace: true,
    });
  },
});
