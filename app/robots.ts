import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/api/",
          "/auth/",
          "/login",
          "/signup",
          "/onboarding",
          "/reset-password",
        ],
      },
    ],
    sitemap: "https://www.neuralreach.de/sitemap.xml",
  };
}
